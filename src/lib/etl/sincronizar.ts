import type { PoolClient } from "pg";

import { conCliente } from "@/lib/db";
import {
  jqlCompleto,
  jqlIncremental,
  normalizar,
  traerIssues,
  type TicketNormalizado,
} from "@/lib/etl/jira";

/**
 * Sincronización Jira → Postgres, en dos modos.
 *
 * ┌─────────────┬──────────────────────────┬───────────────────────────────────┐
 * │ Modo        │ Qué trae                 │ Cómo escribe                      │
 * ├─────────────┼──────────────────────────┼───────────────────────────────────┤
 * │ completo    │ TODO el histórico        │ staging + swap atómico            │
 * │ incremental │ lo movido en N días      │ upsert por clave sobre la tabla   │
 * └─────────────┴──────────────────────────┴───────────────────────────────────┘
 *
 * **Por qué existen los dos.**
 *
 * El botón "Refrescar" del panel usa el modo *incremental*: trae solo lo que
 * cambió y termina en segundos, que es lo que se necesita cuando alguien va a
 * entrar a una reunión y quiere el dato de hoy. Un reload completo de ~9.000
 * tickets tarda minutos y haría que el botón se sintiera roto.
 *
 * Pero el incremental tiene un límite honesto: **no puede enterarse de un
 * ticket BORRADO en Jira**, porque un ticket borrado no aparece en ninguna
 * consulta. Por eso el modo completo sigue existiendo y conviene correrlo cada
 * tanto (`npm run etl`, o el workflow de GitHub Actions).
 */

export type ModoSync = "completo" | "incremental";

export interface ResultadoSync {
  modo: ModoSync;
  totalTickets: number;
  duracionMs: number;
  /** Total de filas en la tabla al terminar. */
  filasEnTabla: number;
}

/** Cuántos días hacia atrás mira el modo incremental. */
export const DIAS_INCREMENTAL = 3;

const COLUMNAS = [
  "clave", "titulo_ticket", "proyecto", "fecha_creacion", "persona_asignada",
  "estado_ticket", "prioridad", "fecha_cierre", "fecha_actualizacion", "tipo_incidencia",
  "tipo_requerimiento", "sede", "dependencia_smm", "area", "comentarios",
  "ttfr_raw", "ttr_raw", "ttfr_horas", "ttr_horas", "ttfr_incumplido",
] as const;

function valoresDe(t: TicketNormalizado): unknown[] {
  return [
    t.clave, t.tituloTicket, t.proyecto, t.fechaCreacion, t.personaAsignada,
    t.estadoTicket, t.prioridad, t.fechaCierre, t.fechaActualizacion, t.tipoIncidencia,
    t.tipoRequerimiento, t.sede, t.dependenciaSmm, t.area, t.comentarios,
    JSON.stringify(t.ttfrRaw), JSON.stringify(t.ttrRaw), t.ttfrHoras, t.ttrHoras, t.ttfrIncumplido,
  ];
}

/**
 * Inserta en lotes de 200.
 *
 * Una sentencia por ticket serían ~9.000 idas y vueltas a Neon: en la práctica
 * es la diferencia entre 20 segundos y varios minutos, y varios minutos no
 * caben en el límite de una función serverless.
 */
async function insertarLotes(
  cliente: PoolClient,
  tabla: string,
  filas: TicketNormalizado[],
  modo: "insertar" | "upsert",
  alProgresar?: (n: number) => void,
): Promise<void> {
  const LOTE = 200;
  const cols = COLUMNAS.join(", ");

  const conflicto =
    modo === "upsert"
      ? `ON CONFLICT (clave) DO UPDATE SET ${COLUMNAS.filter((c) => c !== "clave")
          .map((c) => `${c} = EXCLUDED.${c}`)
          .join(", ")}`
      : "ON CONFLICT (clave) DO NOTHING";

  for (let i = 0; i < filas.length; i += LOTE) {
    const lote = filas.slice(i, i + LOTE);
    const valores: unknown[] = [];
    const marcadores = lote
      .map((f, j) => {
        const base = j * COLUMNAS.length;
        valores.push(...valoresDe(f));
        return `(${COLUMNAS.map((_, k) => `$${base + k + 1}`).join(",")})`;
      })
      .join(",");

    await cliente.query(`INSERT INTO ${tabla} (${cols}) VALUES ${marcadores} ${conflicto}`, valores);
    alProgresar?.(Math.min(i + LOTE, filas.length));
  }
}

/** `ttr_incumplido` se calcula en SQL: la meta depende de la prioridad de cada ticket. */
async function marcarTtrIncumplido(cliente: PoolClient, tabla: string): Promise<void> {
  await cliente.query(`
    UPDATE ${tabla}
    SET ttr_incumplido = ttr_horas > CASE prioridad
      WHEN 'Alta' THEN 4 WHEN 'Media' THEN 8 ELSE 24 END
    WHERE ttr_horas IS NOT NULL
  `);
}

/**
 * ¿Hay otra sincronización corriendo?
 *
 * Evita que dos personas den clic en "Refrescar" al mismo tiempo y se pisen.
 * Se considera colgada a los 15 minutos: si un proceso murió sin cerrar su
 * registro, el candado no puede quedarse trabado para siempre.
 */
export async function syncEnCurso(cliente: PoolClient): Promise<boolean> {
  const r = await cliente.query<{ n: string }>(
    `SELECT count(*) AS n FROM jira_cache.sync_log
     WHERE estado = 'en_curso' AND iniciado_en > now() - interval '15 minutes'`,
  );
  return Number(r.rows[0]?.n ?? 0) > 0;
}

export async function sincronizar(
  opciones: {
    modo?: ModoSync;
    alProgresar?: (etapa: string, n: number, total: number | null) => void;
  } = {},
): Promise<ResultadoSync> {
  const modo = opciones.modo ?? "incremental";
  const inicio = Date.now();

  /*
   * Se comprueba el candado ANTES de bajar nada de Jira.
   *
   * Antes la descarga iba primero y el candado se miraba después, así que N
   * peticiones simultáneas a /api/sync disparaban N descargas completas —unas
   * 90 llamadas paginadas a la API de Jira cada una— y solo entonces se
   * rechazaban. Bastaba con eso para agotar la cuota del token de Jira de
   * SITTI. Ahora la petición de más se corta antes de tocar la red.
   */
  await conCliente(async (cliente) => {
    if (await syncEnCurso(cliente)) {
      throw new Error("Ya hay una sincronización en curso. Espera a que termine.");
    }
  });

  // La descarga desde Jira va ANTES de tomar el cliente de base de datos:
  // puede tardar minutos y no tiene sentido retener una conexión del pool
  // mientras solo se está esperando a la red.
  opciones.alProgresar?.("descargando", 0, null);
  const issues = await traerIssues(
    modo === "completo" ? jqlCompleto() : jqlIncremental(DIAS_INCREMENTAL),
    { alProgresar: (n, total) => opciones.alProgresar?.("descargando", n, total) },
  );
  const filas = issues.map(normalizar);

  return conCliente(async (cliente) => {
    if (await syncEnCurso(cliente)) {
      throw new Error("Ya hay una sincronización en curso. Espera a que termine.");
    }

    const registro = await cliente.query<{ id: string }>(
      "INSERT INTO jira_cache.sync_log (estado, detalle) VALUES ('en_curso', $1) RETURNING id",
      [`modo=${modo}`],
    );
    const syncId = registro.rows[0].id;

    try {
      await cliente.query("BEGIN");

      if (modo === "completo") {
        // Staging + swap: nunca hay una ventana con la tabla vacía.
        await cliente.query("TRUNCATE jira_cache.tickets_staging");
        await insertarLotes(cliente, "jira_cache.tickets_staging", filas, "insertar", (n) =>
          opciones.alProgresar?.("cargando", n, filas.length),
        );
        await marcarTtrIncumplido(cliente, "jira_cache.tickets_staging");

        // Renombrar es instantáneo: solo toca el catálogo de Postgres. Dentro
        // de la transacción nadie ve un estado intermedio.
        await cliente.query("ALTER TABLE jira_cache.tickets_raw RENAME TO tickets_anterior");
        await cliente.query("ALTER TABLE jira_cache.tickets_staging RENAME TO tickets_raw");
        await cliente.query("ALTER TABLE jira_cache.tickets_anterior RENAME TO tickets_staging");
      } else {
        // Incremental: upsert directo. No se trunca nada, así que no hay
        // ventana de datos vacíos ni hace falta el swap.
        await insertarLotes(cliente, "jira_cache.tickets_raw", filas, "upsert", (n) =>
          opciones.alProgresar?.("cargando", n, filas.length),
        );
        await marcarTtrIncumplido(cliente, "jira_cache.tickets_raw");
      }

      const conteo = await cliente.query<{ n: string }>(
        "SELECT count(*) AS n FROM jira_cache.tickets_raw",
      );
      const filasEnTabla = Number(conteo.rows[0]?.n ?? 0);

      await cliente.query(
        `UPDATE jira_cache.sync_log
         SET finalizado_en = now(), estado = 'exito', total_tickets = $1, detalle = $2
         WHERE id = $3`,
        [filas.length, `modo=${modo} · tabla=${filasEnTabla}`, syncId],
      );

      await cliente.query("COMMIT");

      return { modo, totalTickets: filas.length, duracionMs: Date.now() - inicio, filasEnTabla };
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      const mensaje = e instanceof Error ? e.message : String(e);

      // El registro del fallo va FUERA de la transacción que acaba de morir:
      // si fuera parte de ella, el ROLLBACK se llevaría justo la explicación
      // de por qué falló.
      await cliente
        .query(
          `UPDATE jira_cache.sync_log
           SET finalizado_en = now(), estado = 'error', detalle = $1 WHERE id = $2`,
          [mensaje.slice(0, 1000), syncId],
        )
        .catch(() => {});
      await cliente
        .query("INSERT INTO auth.error_log (origen, mensaje) VALUES ('etl', $1)", [
          mensaje.slice(0, 1000),
        ])
        .catch(() => {});

      throw e;
    }
  });
}
