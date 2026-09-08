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
  "reporter", // Informador: quien crea el ticket (el cliente/ciudadano), no quien lo resuelve
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
];

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
  /** Quien creó el ticket (el cliente/ciudadano que reporta), no quien lo resuelve. */
  informador: string | null;
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

// Por CLAVE de proyecto, no por nombre: el nombre visible en Jira puede
// cambiar (espacios, guiones, mayúsculas) sin que la clave se mueva.
const TODOS_LOS_PROYECTOS = PROYECTOS.map((p) => p.clave).join(", ");

/**
 * Regla de oro, pedida explícitamente por Alexis (24 ago 2026): el panel solo
 * opera con el año calendario vigente. Ningún ticket de otro año entra, ni en
 * carga completa ni en incremental — así nunca hay que limpiar histórico viejo
 * a mano. Si el negocio decide ampliar la ventana, este es el único lugar que
 * hay que tocar (y subir el año cuando empiece 2027).
 */
const ANIO_OPERATIVO = 2026;
const FILTRO_ANIO = `created >= "${ANIO_OPERATIVO}-01-01" AND created <= "${ANIO_OPERATIVO}-12-31"`;

export const jqlCompleto = (): string =>
  `project in (${TODOS_LOS_PROYECTOS}) AND ${FILTRO_ANIO} ORDER BY created ASC`;

/**
 * JQL incremental: solo lo que se movió en los últimos N días.
 *
 * Se filtra por `updated` y no por `created` a propósito: un ticket abierto
 * hace tres meses que hoy cambió de estado TIENE que volver a bajarse, y por
 * fecha de creación no entraría. El filtro de año igual aplica sobre `created`,
 * para que un ticket de 2025 que se actualizó hoy no se cuele.
 */
export const jqlIncremental = (dias: number): string =>
  `project in (${TODOS_LOS_PROYECTOS}) AND ${FILTRO_ANIO} AND updated >= "-${dias}d" ORDER BY updated ASC`;

// ─────────────────────────────────────────────────────────────
// JQL de backlog (Fase 2, 8 sep 2026 — ver la nota en catalogo.ts junto a
// `CATEGORIAS_BACKLOG` para el contexto completo de este eje)
// ─────────────────────────────────────────────────────────────

/** Solo los proyectos que sí tienen backlog confirmado (`Proyecto.claveBacklog`). */
const PROYECTOS_CON_BACKLOG = PROYECTOS.filter((p) => p.claveBacklog);
const CLAVES_BACKLOG = PROYECTOS_CON_BACKLOG.map((p) => p.claveBacklog).join(", ");

export const hayProyectosBacklog = (): boolean => PROYECTOS_CON_BACKLOG.length > 0;

/**
 * Sin filtro de año a propósito: el backlog de desarrollo no es un
 * histórico "por año calendario" como los tickets de operación — un ítem
 * en Gestión de CA puede llevar abierto desde antes de 2026.
 */
export const jqlBacklogCompleto = (): string => `project in (${CLAVES_BACKLOG}) ORDER BY created ASC`;

export const jqlBacklogIncremental = (dias: number): string =>
  `project in (${CLAVES_BACKLOG}) AND updated >= "-${dias}d" ORDER BY updated ASC`;

/** Campos de backlog — mucho más chico que `CAMPOS`: no hay SLA, prioridad, ni switch de área. */
export const CAMPOS_BACKLOG = ["summary", "project", "created", "updated", "status"];

// ─────────────────────────────────────────────────────────────
// Descarga
// ─────────────────────────────────────────────────────────────

/**
 * `GET /rest/api/3/search` fue ELIMINADO por Atlassian (HTTP 410). El
 * reemplazo, `POST /rest/api/3/search/jql`, cambia dos cosas de fondo:
 *   1. Va por POST con body JSON, no por querystring.
 *   2. Pagina con `nextPageToken`, no con `startAt`/`total`. La API ya no
 *      garantiza el conteo total, así que no se puede mostrar "traídos / total"
 *      de forma confiable — solo "traídos hasta ahora".
 */
export async function traerIssues(
  jql: string,
  opciones: {
    limite?: number;
    /** Campos a pedir a Jira. Default: `CAMPOS` (los del ETL operativo). */
    campos?: string[];
    alProgresar?: (traidos: number, total: number | null) => void;
  } = {},
): Promise<IssueJira[]> {
  const { base, auth } = credencialesJira();
  const issues: IssueJira[] = [];
  let nextPageToken: string | undefined;

  for (;;) {
    const maxResults = Math.min(100, opciones.limite ? opciones.limite - issues.length : 100);
    if (maxResults <= 0) break;

    const res = await fetch(`${base}/rest/api/3/search/jql`, {
      method: "POST",
      headers: {
        Authorization: auth,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jql,
        fields: opciones.campos ?? CAMPOS,
        maxResults,
        ...(nextPageToken ? { nextPageToken } : {}),
      }),
    });

    if (!res.ok) {
      throw new Error(`Jira respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }

    const cuerpo = (await res.json()) as {
      issues?: IssueJira[];
      nextPageToken?: string;
    };
    const lote = cuerpo.issues ?? [];
    issues.push(...lote);
    opciones.alProgresar?.(issues.length, null);

    nextPageToken = cuerpo.nextPageToken;
    if (!nextPageToken) break;
    if (opciones.limite && issues.length >= opciones.limite) break;
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

const POR_CLAVE = new Map(PROYECTOS.map((p) => [p.clave, p]));

/** La clave del proyecto (ej. "TDEI"), no el nombre visible. `f.project` trae `{id, key, name}`. */
const claveProyecto = (v: unknown): string | null => {
  if (v != null && typeof v === "object" && typeof (v as { key?: unknown }).key === "string") {
    return (v as { key: string }).key;
  }
  return null;
};

/**
 * Jira devuelve la prioridad como "ALTO"/"MEDIO"/"BAJO" (masculino, mayúscula);
 * el catálogo usa "Alta"/"Media"/"Baja". Sin este mapeo, `prioridad` nunca
 * matchea una clave de `META_TTR_HORAS` y todo ticket cae al default Media,
 * falseando el cumplimiento de TTR de los de prioridad Alta y Baja.
 */
const PRIORIDAD_JIRA_A_CATALOGO: Record<string, Prioridad> = {
  ALTO: "Alta",
  ALTA: "Alta",
  MEDIO: "Media",
  MEDIA: "Media",
  BAJO: "Baja",
  BAJA: "Baja",
};

const prioridadDesdeJira = (v: unknown): Prioridad => {
  const literal = texto(v)?.toUpperCase() ?? "";
  return PRIORIDAD_JIRA_A_CATALOGO[literal] ?? "Media";
};

/**
 * `customfield_10010` (Request Type) no trae `{name}` en la raíz como los
 * demás campos de selección: el nombre vive en `requestType.name`.
 */
const tipoRequerimientoDesdeJira = (v: unknown): string | null => {
  if (v != null && typeof v === "object") {
    const rt = (v as { requestType?: { name?: unknown } }).requestType;
    if (rt && typeof rt.name === "string") return rt.name;
  }
  return null;
};

export function normalizar(issue: IssueJira): TicketNormalizado {
  const f = issue.fields ?? {};
  const conf = POR_CLAVE.get(claveProyecto(f.project) ?? "");
  // Nombre CANÓNICO del catálogo, no el literal de Jira ("DEI - Tickets",
  // "Mesa de ayuda - SMM"...): `jira_cache.v_tickets` compara `proyecto` por
  // texto exacto contra 'Mesa de ayuda SMM' para el switch de Área — si acá
  // quedara el nombre crudo de Jira, esa comparación dejaría de matchear.
  const proyecto = conf?.nombre ?? texto(f.project);

  const prioridad = prioridadDesdeJira(f.priority);
  const metaTtr = META_TTR_HORAS[prioridad];

  const ttfrHoras = parsearSla(f.customfield_10044);
  const ttrHoras = parsearSla(f.customfield_10043);

  return {
    clave: String(issue.key),
    tituloTicket: texto(f.summary),
    proyecto,
    fechaCreacion: texto(f.created),
    personaAsignada: texto(f.assignee),
    informador: texto(f.reporter),
    estadoTicket: (texto(f.status) ?? "").toUpperCase(),
    prioridad,
    fechaCierre: texto(f.resolutiondate),
    fechaActualizacion: texto(f.updated),
    tipoIncidencia: texto(f.issuetype),
    tipoRequerimiento: tipoRequerimientoDesdeJira(f.customfield_10010),
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

// ─────────────────────────────────────────────────────────────
// Normalización de backlog (Fase 2)
// ─────────────────────────────────────────────────────────────

export interface BacklogNormalizado {
  clave: string;
  tituloTicket: string | null;
  /** `Aplicativo.clave` (catalogo.ts, ej. "taw"), NO la clave del proyecto de Jira (ej. "BAWS"). */
  aplicativoClave: string;
  estadoTicket: string;
  fechaCreacion: string | null;
  fechaActualizacion: string | null;
}

/** Clave del proyecto de backlog en Jira (ej. "BAWS") -> `Aplicativo.clave` (ej. "taw"). */
const APLICATIVO_POR_CLAVE_BACKLOG = new Map(
  PROYECTOS_CON_BACKLOG.map((p) => [p.claveBacklog as string, p.clave.toLowerCase()]),
);

export function normalizarBacklog(issue: IssueJira): BacklogNormalizado {
  const f = issue.fields ?? {};
  const claveProyectoBacklog = claveProyecto(f.project) ?? "";

  return {
    clave: String(issue.key),
    tituloTicket: texto(f.summary),
    aplicativoClave: APLICATIVO_POR_CLAVE_BACKLOG.get(claveProyectoBacklog) ?? claveProyectoBacklog.toLowerCase(),
    estadoTicket: (texto(f.status) ?? "").toUpperCase(),
    fechaCreacion: texto(f.created),
    fechaActualizacion: texto(f.updated),
  };
}
