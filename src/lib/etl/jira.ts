/**
 * Cliente de Jira y normalización de tickets.
 *
 * Este archivo es el ÚNICO lugar donde vive la lógica de traducir un issue de
 * Jira a una fila de `tickets_raw`. Lo usan tanto el script de línea de
 * comandos (`npm run etl`) como el botón "Refrescar" de la app.
 *
 * Que esté centralizado no es estética: la regla del switch de Área por
 * proyecto (SMM usa `customfield_11698`) es fácil de olvidar, y duplicada en
 * dos rutas de código habría terminado aplicándose en una y en la otra no —
 * con el resultado de que el área más grande de la empresa aparecería vacía
 * según por dónde se hubiera sincronizado.
 */

import { META_TTFR_HORAS, META_TTR_HORAS, PROYECTOS, type Prioridad } from "@/lib/catalogo";

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

export interface IssueJira {
  key?: string;
  fields?: Record<string, unknown>;
}

export interface TicketNormalizado {
  clave: string;
  tituloTicket: string | null;
  proyecto: string | null;
  fechaCreacion: string | null;
  personaAsignada: string | null;
  estadoTicket: string;
  prioridad: Prioridad;
  fechaCierre: string | null;
  fechaActualizacion: string | null;
  tipoIncidencia: string | null;
  tipoRequerimiento: string | null;
  sede: string | null;
  dependenciaSmm: string | null;
  area: string | null;
  comentarios: number;
  ttfrRaw: unknown;
  ttrRaw: unknown;
  ttfrHoras: number | null;
  ttrHoras: number | null;
  ttfrIncumplido: boolean | null;
  ttrIncumplido: boolean | null;
}

// ─────────────────────────────────────────────────────────────
// Credenciales
// ─────────────────────────────────────────────────────────────

export function credencialesJira() {
  const base = process.env.JIRA_BASE_URL;
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!base || !email || !token) {
    throw new Error(
      "Faltan credenciales de Jira (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN). Ver CLAUDE.md § 5.1.",
    );
  }

  return {
    base: base.replace(/\/$/, ""),
    auth: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`,
  };
}

export const hayCredencialesJira = (): boolean =>
  Boolean(process.env.JIRA_BASE_URL && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN);

// ─────────────────────────────────────────────────────────────
// JQL
// ─────────────────────────────────────────────────────────────

const TODOS_LOS_PROYECTOS = PROYECTOS.map((p) => `"${p.nombre}"`).join(", ");

export const jqlCompleto = (): string =>
  `project in (${TODOS_LOS_PROYECTOS}) ORDER BY created ASC`;

/**
 * JQL incremental: solo lo que se movió en los últimos N días.
 *
 * Se filtra por `updated` y no por `created` a propósito: un ticket abierto
 * hace tres meses que hoy cambió de estado TIENE que volver a bajarse, y por
 * fecha de creación no entraría.
 */
export const jqlIncremental = (dias: number): string =>
  `project in (${TODOS_LOS_PROYECTOS}) AND updated >= "-${dias}d" ORDER BY updated ASC`;

// ─────────────────────────────────────────────────────────────
// Descarga
// ─────────────────────────────────────────────────────────────

export async function traerIssues(
  jql: string,
  opciones: { limite?: number; alProgresar?: (traidos: number, total: number | null) => void } = {},
): Promise<IssueJira[]> {
  const { base, auth } = credencialesJira();
  const issues: IssueJira[] = [];
  let startAt = 0;

  for (;;) {
    const maxResults = Math.min(100, opciones.limite ? opciones.limite - issues.length : 100);
    if (maxResults <= 0) break;

    const url =
      `${base}/rest/api/3/search?jql=${encodeURIComponent(jql)}` +
      `&fields=${CAMPOS}&startAt=${startAt}&maxResults=${maxResults}`;

    const res = await fetch(url, { headers: { Authorization: auth, Accept: "application/json" } });

    if (!res.ok) {
      throw new Error(`Jira respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const cuerpo = (await res.json()) as { issues?: IssueJira[]; total?: number };
    const lote = cuerpo.issues ?? [];
    issues.push(...lote);
    opciones.alProgresar?.(issues.length, cuerpo.total ?? null);

    if (lote.length < maxResults) break;
    if (opciones.limite && issues.length >= opciones.limite) break;
    startAt += lote.length;
  }

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
 * ⚠️ AJUSTAR con lo que muestre `npm run etl -- --dry-run`. Hoy cubre las tres
 * formas posibles, en orden de probabilidad:
 *   1. Objeto SLA cerrado  → `completedCycles[].elapsedTime.millis`
 *   2. Objeto SLA en curso → `ongoingCycle.elapsedTime.millis`
 *   3. Número plano (minutos o milisegundos, según la configuración)
 *
 * Devuelve `null` y no 0 cuando no hay dato: un 0 significaría "se resolvió al
 * instante" y falsearía el cumplimiento del SLA hacia arriba.
 */
export function parsearSla(v: unknown): number | null {
  if (v == null) return null;

  if (typeof v === "number") {
    // Heurística: por encima de 100.000 casi seguro son milisegundos.
    return v > 100_000 ? v / 3_600_000 : v / 60;
  }

  if (typeof v === "object") {
    const o = v as ObjetoSla;

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

/**
 * Forma esperada del objeto de SLA de Jira.
 *
 * Todo es opcional porque es una hipótesis hasta que el `--dry-run` contra el
 * Jira real la confirme: describe lo que se cree que llega, no un contrato
 * verificado. Por eso `parsearSla()` comprueba cada nivel antes de usarlo en
 * vez de confiar en el tipo.
 */
interface CicloSla {
  elapsedTime?: { millis?: number };
}
interface ObjetoSla {
  completedCycles?: CicloSla[];
  ongoingCycle?: CicloSla;
}

const POR_NOMBRE = new Map(PROYECTOS.map((p) => [p.nombre, p]));

export function normalizar(issue: IssueJira): TicketNormalizado {
  const f = issue.fields ?? {};
  const proyecto = texto(f.project);
  const conf = proyecto ? POR_NOMBRE.get(proyecto) : undefined;

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
    // Los dos campos de área se guardan SEPARADOS. No se combinan acá:
    // quien consulta elige, vía la vista `jira_cache.v_tickets`.
    dependenciaSmm: texto(f.customfield_11698),
    area: texto(f.customfield_10506),
    comentarios: (f.comment as { total?: number } | undefined)?.total ?? 0,
    ttfrRaw: f.customfield_10044 ?? null,
    ttrRaw: f.customfield_10043 ?? null,
    ttfrHoras,
    ttrHoras,
    ttfrIncumplido: ttfrHoras !== null ? ttfrHoras > META_TTFR_HORAS : null,
    ttrIncumplido: ttrHoras !== null ? ttrHoras > metaTtr : null,
  };
}
