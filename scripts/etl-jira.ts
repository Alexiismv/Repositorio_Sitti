/**
 * ETL Jira (JSM) → PostgreSQL.
 *
 *   npm run etl -- --dry-run    trae 10 tickets y los IMPRIME. No escribe nada.
 *   npm run etl                 corrida completa: staging → swap atómico
 *
 * Corre 2 veces al día (decisión confirmada: no hace falta tiempo real).
 *
 * ─────────────────────────────────────────────────────────────────────
 * DOS COSAS QUE HAY QUE ENTENDER ANTES DE TOCAR ESTE ARCHIVO
 * ─────────────────────────────────────────────────────────────────────
 *
 * 1. **Staging + swap atómico, no truncate en vivo.**
 *    Cargar directo sobre `tickets_raw` implicaría truncarla primero, y entre
 *    ese TRUNCATE y el último INSERT hay varios minutos en los que el panel
 *    mostraría "0 tickets". Todo el mundo pensaría que se cayó el sistema.
 *    Acá se llena `tickets_staging` con calma y al final se intercambian los
 *    nombres dentro de UNA transacción: para quien está mirando el panel, el
 *    cambio es instantáneo.
 *
 * 2. **El switch de Área por proyecto.**
 *    "Mesa de ayuda SMM" NO usa `customfield_10506` para Área: usa
 *    `customfield_11698` (Dependencia_SMM). El ETL guarda los DOS campos en
 *    columnas separadas y NO los combina — quien consulta elige, vía la vista
 *    `jira_cache.v_tickets`. Si acá se "arreglara" fusionándolos, se perdería
 *    el dato original y nunca se podría auditar cuál venía de dónde.
 *
 * ⚠️ PENDIENTE CONFIRMADO EN EL LEVANTAMIENTO: el formato real de
 * `customfield_10044` (TTFR) y `customfield_10043` (TTR). Se sospecha que son
 * objetos de SLA de Jira (con `ongoingCycle` / `completedCycles`), no números.
 * Por eso `--dry-run` imprime el objeto crudo: mira lo que llega, ajusta
 * `parsearSla()` y anota el hallazgo en docs/REQUISITOS.md.
 */

import { META_TTFR_HORAS, META_TTR_HORAS, PROYECTOS, type Prioridad } from "../src/lib/catalogo";
import { cargarEnv, conectar } from "./db";

const DRY_RUN = process.argv.includes("--dry-run");

// ─────────────────────────────────────────────────────────────
// Cliente de Jira
// ─────────────────────────────────────────────────────────────

const CAMPOS = [
  "summary",
  "project",
  "created",
  "updated",
  "assignee",
  "status",
  "priority",
  "resolutiondate",
  "issuetype",
  "comment",
  "customfield_10010", // Tipo_de_Requerimiento
  "customfield_10066", // Sede
  "customfield_11698", // Dependencia_SMM  (solo Mesa de ayuda SMM)
  "customfield_10506", // Área             (los otros 11 proyectos)
  "customfield_10044", // TTFR
  "customfield_10043", // TTR
].join(",");

interface CampoJira {
  [k: string]: unknown;
}

function credenciales() {
  cargarEnv();
  const base = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!base || !email || !token) {
    throw new Error(
      "Faltan credenciales de Jira. Define JIRA_BASE_URL, JIRA_EMAIL y JIRA_API_TOKEN en .env.\n" +
        "Cómo sacar el token: CLAUDE.md § 5.1.",
    );
  }
  return {
    base: base.replace(/\/$/, ""),
    auth: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
  };
}

/**
 * Trae issues paginando. La API de Jira Cloud tope 100 por página.
 *
 * Se pide EXPLÍCITAMENTE la lista de campos en vez de traer todo: además de
 * ser más rápido, evita arrastrar campos con datos personales de ciudadanos
 * que esta app no necesita ver.
 */
async function traerIssues(jql: string, limite?: number): Promise<CampoJira[]> {
  const { base, auth } = credenciales();
  const issues: CampoJira[] = [];
  let startAt = 0;

  for (;;) {
    const maxResults = Math.min(100, limite ? limite - issues.length : 100);
    if (maxResults <= 0) break;

    const url =
      `${base}/rest/api/3/search?jql=${encodeURIComponent(jql)}` +
      `&fields=${CAMPOS}&startAt=${startAt}&maxResults=${maxResults}`;

    const res = await fetch(url, {
      headers: { Authorization: auth, Accept: "application/json" },
    });

    if (!res.ok) {
      throw new Error(`Jira respondió ${res.status}: ${(await res.text()).slice(0, 400)}`);
    }

    const cuerpo = (await res.json()) as { issues?: CampoJira[]; total?: number };
    const lote = cuerpo.issues ?? [];
    issues.push(...lote);

    process.stdout.write(`\r   ${issues.length} / ${cuerpo.total ?? "?"} tickets…`);

    if (lote.length < maxResults) break;
    if (limite && issues.length >= limite) break;
    startAt += lote.length;
  }

  process.stdout.write("\n");
  return issues;
}

// ─────────────────────────────────────────────────────────────
// Normalización
// ─────────────────────────────────────────────────────────────

const texto = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // Jira devuelve {name} para status/priority, {displayName} para assignee,
    // {value} para campos de selección.
    for (const k of ["name", "displayName", "value"]) {
      if (typeof o[k] === "string") return o[k] as string;
    }
  }
  return String(v);
};

/**
 * Convierte el campo de SLA de Jira a horas.
 *
 * ⚠️ AJUSTAR con lo que muestre `--dry-run`. Hoy cubre las tres formas que
 * puede tomar, en orden de probabilidad:
 *   1. Objeto SLA completo → `completedCycles[].elapsedTime.millis`
 *   2. Objeto SLA en curso → `ongoingCycle.elapsedTime.millis`
 *   3. Número plano (minutos o milisegundos, según cómo lo hayan configurado)
 *
 * Devuelve `null` en vez de 0 cuando no hay dato: 0 significaría "se resolvió
 * al instante", y eso falsearía el cumplimiento del SLA hacia arriba.
 */
export function parsearSla(v: unknown): number | null {
  if (v == null) return null;

  if (typeof v === "number") {
    // Heurística: más de 100.000 casi seguro son milisegundos, no minutos.
    return v > 100_000 ? v / 3_600_000 : v / 60;
  }

  if (typeof v === "object") {
    const o = v as Record<string, any>;
    const completados = o.completedCycles;
    if (Array.isArray(completados) && completados.length) {
      const ms = completados[completados.length - 1]?.elapsedTime?.millis;
      if (typeof ms === "number") return ms / 3_600_000;
    }
    const ms = o.ongoingCycle?.elapsedTime?.millis;
    if (typeof ms === "number") return ms / 3_600_000;
  }

  return null;
}

const VOCAB = new Map(PROYECTOS.map((p) => [p.nombre, p]));

function normalizar(issue: CampoJira) {
  const f = (issue.fields ?? {}) as Record<string, unknown>;
  const proyecto = texto(f.project);
  const conf = proyecto ? VOCAB.get(proyecto) : undefined;

  const prioridad = (texto(f.priority) ?? "Media") as Prioridad;
  const metaTtr = META_TTR_HORAS[prioridad] ?? META_TTR_HORAS.Media;

  const ttfrHoras = parsearSla(f.customfield_10044);
  const ttrHoras = parsearSla(f.customfield_10043);

  return {
    clave: String(issue.key),
    tituloTicket: texto(f.summary),
    proyecto,
    fechaCreacion: texto(f.created),
    personaAsignada: texto(f.assignee),
    estadoTicket: (texto(f.status) ?? "").toUpperCase(),
    prioridad,
    fechaCierre: texto(f.resolutiondate),
    fechaActualizacion: texto(f.updated),
    tipoIncidencia: texto(f.issuetype),
    tipoRequerimiento: texto(f.customfield_10010),
    // Regla dura: "Mesa de ayuda SMM" no trae Sede; es SIEMPRE Caribe.
    sede: conf?.sedeFija ?? texto(f.customfield_10066),
    // Los dos campos de área se guardan SEPARADOS. No se combinan acá.
    dependenciaSmm: texto(f.customfield_11698),
    area: texto(f.customfield_10506),
    comentarios: (f.comment as { total?: number })?.total ?? 0,
    ttfrRaw: f.customfield_10044 ?? null,
    ttrRaw: f.customfield_10043 ?? null,
    ttfrHoras,
    ttrHoras,
    ttfrIncumplido: ttfrHoras !== null ? ttfrHoras > META_TTFR_HORAS : null,
    ttrIncumplido: ttrHoras !== null ? ttrHoras > metaTtr : null,
  };
}

// ─────────────────────────────────────────────────────────────
// Corrida
// ─────────────────────────────────────────────────────────────

async function main() {
  const proyectos = PROYECTOS.map((p) => `"${p.nombre}"`).join(", ");
  const jql = `project in (${proyectos}) ORDER BY created ASC`;

  if (DRY_RUN) {
    console.log("🔍 Dry run — 10 tickets, sin escribir en la base.\n");
    const issues = await traerIssues(jql, 10);

    if (!issues.length) {
      console.log("No llegó ningún ticket. Revisa el JQL y los permisos de la cuenta.");
      return;
    }

    const f = (issues[0].fields ?? {}) as Record<string, unknown>;
    console.log("\n─── ESTO ES LO QUE FALTABA CONFIRMAR ───");
    console.log("customfield_10044 (TTFR) llega así:");
    console.log(JSON.stringify(f.customfield_10044, null, 2));
    console.log("\ncustomfield_10043 (TTR) llega así:");
    console.log(JSON.stringify(f.customfield_10043, null, 2));
    console.log(
      "\n→ Si `parsearSla()` no interpreta bien esa forma, ajústala y anota el\n" +
        "  hallazgo en docs/REQUISITOS.md (sección 7) y en CLAUDE.md §9.1.\n",
    );

    console.log("─── Normalizado (primeros 3) ───");
    for (const i of issues.slice(0, 3)) console.log(normalizar(i));
    return;
  }

  const cliente = await conectar();
  const inicio = await cliente.query<{ id: string }>(
    "INSERT INTO jira_cache.sync_log (estado) VALUES ('en_curso') RETURNING id",
  );
  const syncId = inicio.rows[0].id;

  try {
    console.log("→ Trayendo tickets de Jira…");
    const issues = await traerIssues(jql);
    const filas = issues.map(normalizar);

    console.log(`→ ${filas.length} tickets normalizados. Cargando a staging…`);

    await cliente.query("BEGIN");
    await cliente.query("TRUNCATE jira_cache.tickets_staging");

    // Inserción por lotes: una sentencia por ticket serían ~9.000 round-trips
    // a Neon, que en la práctica es la diferencia entre 20 segundos y 6 minutos.
    const LOTE = 200;
    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE);
      const valores: unknown[] = [];
      const marcadores = lote
        .map((f, j) => {
          const b = j * 20;
          valores.push(
            f.clave, f.tituloTicket, f.proyecto, f.fechaCreacion, f.personaAsignada,
            f.estadoTicket, f.prioridad, f.fechaCierre, f.fechaActualizacion, f.tipoIncidencia,
            f.tipoRequerimiento, f.sede, f.dependenciaSmm, f.area, f.comentarios,
            JSON.stringify(f.ttfrRaw), JSON.stringify(f.ttrRaw), f.ttfrHoras, f.ttrHoras,
            f.ttfrIncumplido,
          );
          return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13},$${b + 14},$${b + 15},$${b + 16},$${b + 17},$${b + 18},$${b + 19},$${b + 20})`;
        })
        .join(",");

      await cliente.query(
        `INSERT INTO jira_cache.tickets_staging
           (clave, titulo_ticket, proyecto, fecha_creacion, persona_asignada,
            estado_ticket, prioridad, fecha_cierre, fecha_actualizacion, tipo_incidencia,
            tipo_requerimiento, sede, dependencia_smm, area, comentarios,
            ttfr_raw, ttr_raw, ttfr_horas, ttr_horas, ttfr_incumplido)
         VALUES ${marcadores}
         ON CONFLICT (clave) DO NOTHING`,
        valores,
      );
      process.stdout.write(`\r   ${Math.min(i + LOTE, filas.length)} / ${filas.length}`);
    }
    process.stdout.write("\n");

    // `ttr_incumplido` se calcula en SQL para no arrastrar otro parámetro:
    // la meta depende de la prioridad de cada ticket.
    await cliente.query(`
      UPDATE jira_cache.tickets_staging
      SET ttr_incumplido = ttr_horas > CASE prioridad
        WHEN 'Alta' THEN 4 WHEN 'Media' THEN 8 ELSE 24 END
      WHERE ttr_horas IS NOT NULL
    `);

    // ── SWAP ATÓMICO ──
    // Renombrar es instantáneo (solo toca el catálogo de Postgres). Dentro de
    // la transacción, nadie ve un estado intermedio: o ve los datos viejos, o
    // ve los nuevos. Nunca ve la tabla vacía.
    await cliente.query("ALTER TABLE jira_cache.tickets_raw RENAME TO tickets_anterior");
    await cliente.query("ALTER TABLE jira_cache.tickets_staging RENAME TO tickets_raw");
    await cliente.query("ALTER TABLE jira_cache.tickets_anterior RENAME TO tickets_staging");

    await cliente.query(
      `UPDATE jira_cache.sync_log
       SET finalizado_en = now(), estado = 'exito', total_tickets = $1 WHERE id = $2`,
      [filas.length, syncId],
    );

    await cliente.query("COMMIT");
    console.log(`\n✅ Sync completo: ${filas.length} tickets.`);
    console.log("   Si aún está en DEMO_MODE=true, ya puedes ponerlo en false.");
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    const mensaje = e instanceof Error ? e.message : String(e);

    // El registro del fallo va en su PROPIA transacción: el ROLLBACK de arriba
    // ya deshizo todo, y si esto fuera parte de esa transacción se perdería
    // justo el registro de por qué falló.
    await cliente
      .query(
        `UPDATE jira_cache.sync_log
         SET finalizado_en = now(), estado = 'error', detalle = $1 WHERE id = $2`,
        [mensaje.slice(0, 1000), syncId],
      )
      .catch(() => {});
    await cliente
      .query(
        `INSERT INTO auth.error_log (origen, mensaje) VALUES ('etl', $1)`,
        [mensaje.slice(0, 1000)],
      )
      .catch(() => {});

    throw e;
  } finally {
    await cliente.end();
  }
}

main().catch((e) => {
  console.error("\n❌ ETL falló:\n", e instanceof Error ? e.message : e);
  process.exit(1);
});
