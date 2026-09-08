/**
 * Proveedor de datos — la única puerta por la que la UI pide tickets.
 *
 * Hoy devuelve el dataset DEMO en memoria. Cuando Alexis conecte Postgres,
 * solo se implementa `obtenerTicketsDesdeDB` y se pone `DEMO_MODE=false`:
 * ninguna pantalla cambia, porque todas piden por acá.
 *
 * Los filtros de este archivo son los mismos ejes que expone la UI
 * (fecha, sede, área, gerencia, persona, estado, proyecto) y se traducen 1:1
 * a un `WHERE` sobre `jira_cache.tickets_raw`.
 */

import { ticketsBacklogDemo, type TicketBacklog } from "@/lib/demo/generador-backlog";
import { ticketsDemo, type Ticket } from "@/lib/demo/generador";
import { DEMO_MODE } from "@/lib/modo";
import { puedeVer, type Sesion } from "@/lib/auth/tipos";
import {
  ALIAS_AREA,
  AREAS,
  DIAS_ESTANCADO_DEFAULT,
  PROYECTOS,
  SEDES,
  type CategoriaEstado,
  type Prioridad,
} from "@/lib/catalogo";
import { conCliente } from "@/lib/db";

export interface Filtros {
  /** ISO date (inclusive) sobre `fecha_creacion`. */
  desde?: string;
  /** ISO date (inclusive) sobre `fecha_creacion`. */
  hasta?: string;
  sedes?: string[];
  areas?: string[];
  gerencias?: string[];
  personas?: string[];
  proyectos?: string[];
  tiposRequerimiento?: string[];
  prioridades?: string[];
  /**
   * Filtro de estado. Además de los dos agregados históricos ("pendientes" =
   * todo lo que no es resuelto ni cancelado, "resueltos" = solo resuelto),
   * acepta cualquiera de las 5 categorías normalizadas de `CategoriaEstado`
   * y "resueltos-cancelados" — el mismo agrupamiento que usa el tablero de
   * Nivel 3 para su columna combinada — así el link "+N más" de cada columna
   * del tablero puede pedir exactamente lo que esa columna está mostrando.
   */
  estado?: "todos" | "pendientes" | "resueltos" | "resueltos-cancelados" | CategoriaEstado;
  /** Solo tickets que ya incumplieron TTR o TTFR (el "en rojo"). */
  soloIncumplidos?: boolean;
  /** Solo tickets abiertos sin movimiento hace DIAS_ESTANCADO_DEFAULT+ días. */
  soloEstancados?: boolean;
}

// Se re-exporta para no tocar los ~10 módulos que ya lo importan desde acá.
export { DEMO_MODE };

const slugDeSede = new Map(SEDES.map((s) => [s.nombre, s.slug]));
const areaPorNombre = new Map(AREAS.map((a) => [a.nombre, a]));
const claveDeProyecto = new Map(PROYECTOS.map((p) => [p.nombre, p.clave]));
const AREA_OTRAS = AREAS.find((a) => a.slug === "otras")!;
const AREA_SIN_NOMBRE = AREAS.find((a) => a.slug === "sin-nombre")!;

/**
 * `area_efectiva` en `jira_cache.v_tickets` es texto libre traído de Jira, no
 * un slug del catálogo. Tres casos:
 *   1. NULL (campo nunca se llenó en Jira) -> bucket "sin-nombre".
 *   2. Coincide con el nombre de una de las 18 áreas -> esa área.
 *   3. Cualquier otro texto (la opción literal "Otras", o los valores propios
 *      de Dependencia SMM como "Subsecretaría de Seguridad Vial y Control",
 *      que NO son ninguna de las 18 áreas — ver CLAUDE.md § 9 punto 2, pendiente
 *      de que Alexis defina a qué gerencia mapea cada dependencia) -> "Otras",
 *      para no perder el ticket mientras se define la reclasificación.
 */
export function resolverArea(nombreArea: string | null): { area: string; areaSlug: string; gerenciaSlug: string } {
  if (nombreArea === null) {
    return { area: AREA_SIN_NOMBRE.nombre, areaSlug: AREA_SIN_NOMBRE.slug, gerenciaSlug: AREA_SIN_NOMBRE.gerencia };
  }
  const nombreCanonico = ALIAS_AREA[nombreArea] ?? nombreArea;
  const conocida = areaPorNombre.get(nombreCanonico);
  if (conocida) {
    return { area: conocida.nombre, areaSlug: conocida.slug, gerenciaSlug: conocida.gerencia };
  }
  return { area: nombreArea, areaSlug: AREA_OTRAS.slug, gerenciaSlug: AREA_OTRAS.gerencia };
}

function cumpleFiltros(t: Ticket, f: Filtros): boolean {
  if (f.desde && t.fechaCreacion < f.desde) return false;
  if (f.hasta && t.fechaCreacion > f.hasta) return false;
  if (f.sedes?.length && !f.sedes.includes(slugDeSede.get(t.sede) ?? t.sede)) return false;
  if (f.areas?.length && !f.areas.includes(t.areaSlug)) return false;
  if (f.gerencias?.length && !f.gerencias.includes(t.gerenciaSlug)) return false;
  if (f.personas?.length && !f.personas.includes(t.personaAsignada)) return false;
  if (f.proyectos?.length && !f.proyectos.includes(t.proyectoClave)) return false;
  if (f.tiposRequerimiento?.length && !f.tiposRequerimiento.includes(t.tipoRequerimiento)) return false;
  if (f.prioridades?.length && !f.prioridades.includes(t.prioridad)) return false;

  if (f.estado === "pendientes" && (t.categoriaEstado === "resuelto" || t.categoriaEstado === "cancelado")) {
    return false;
  }
  if (f.estado === "resueltos" && t.categoriaEstado !== "resuelto") return false;
  if (
    f.estado === "resueltos-cancelados" &&
    t.categoriaEstado !== "resuelto" &&
    t.categoriaEstado !== "cancelado"
  ) {
    return false;
  }
  if (
    (f.estado === "pendiente" ||
      f.estado === "en-progreso" ||
      f.estado === "esperando-terceros" ||
      f.estado === "cancelado") &&
    t.categoriaEstado !== f.estado
  ) {
    return false;
  }
  if (f.soloIncumplidos && !(t.ttrIncumplido || t.ttfrIncumplido)) return false;
  if (f.soloEstancados) {
    const abierto = t.categoriaEstado !== "resuelto" && t.categoriaEstado !== "cancelado";
    if (!(abierto && t.diasSinActualizar >= DIAS_ESTANCADO_DEFAULT)) return false;
  }

  return true;
}

/**
 * Devuelve los tickets visibles para esta sesión con los filtros aplicados.
 *
 * El recorte por permisos se aplica SIEMPRE acá, aunque la UI ya haya filtrado.
 * Es defense-in-depth: si mañana una pantalla nueva se olvida de filtrar,
 * un coordinador sigue sin poder ver sedes/áreas que no le tocan.
 */
export async function obtenerTickets(sesion: Sesion, filtros: Filtros = {}): Promise<Ticket[]> {
  const todos = DEMO_MODE ? ticketsDemo() : await obtenerTicketsDesdeDB();

  return todos.filter((t) => {
    const sedeSlug = slugDeSede.get(t.sede) ?? t.sede;
    if (!puedeVer(sesion, sedeSlug, t.areaSlug)) return false;
    return cumpleFiltros(t, filtros);
  });
}

/**
 * Backlog de desarrollo de un aplicativo (tablero secundario del módulo
 * Aplicativos). No pasa por `puedeVer()`: el backlog es trabajo interno del
 * equipo, no tiene sede/área — el filtro real de acceso es la pantalla
 * "aplicativos" (`puedeVerPantalla`), ya aplicado antes de llegar acá.
 *
 * Fase 1: solo `DEMO_MODE`. Fase 2 (pendiente): cuando exista el ETL de
 * backlog (ver la nota en `catalogo.ts` junto a `CATEGORIAS_BACKLOG`), este
 * `[]` se reemplaza por una consulta a la tabla nueva — ninguna pantalla
 * necesita cambiar.
 */
export async function obtenerBacklog(aplicativoClave: string): Promise<TicketBacklog[]> {
  const todos = DEMO_MODE ? ticketsBacklogDemo() : [];
  return todos.filter((t) => t.aplicativoClave === aplicativoClave);
}

/** Metadatos del último sync, para el sello de "actualizado hace…" en la UI. */
export async function ultimaSincronizacion(): Promise<{ fecha: string; total: number; estado: "exito" | "error" }> {
  if (DEMO_MODE) {
    const { FECHA_CORTE } = await import("@/lib/demo/generador");
    return { fecha: FECHA_CORTE.toISOString(), total: ticketsDemo().length, estado: "exito" };
  }

  return conCliente(async (cliente) => {
    const r = await cliente.query<{
      finalizado_en: Date | null;
      iniciado_en: Date;
      total_tickets: number | null;
      estado: "en_curso" | "exito" | "error";
    }>(
      `SELECT finalizado_en, iniciado_en, total_tickets, estado
       FROM jira_cache.sync_log
       WHERE estado IN ('exito', 'error')
       ORDER BY finalizado_en DESC NULLS LAST
       LIMIT 1`,
    );

    const fila = r.rows[0];
    if (!fila) {
      // Tabla real pero sin ninguna corrida registrada todavía (recién aplicado
      // el schema, antes del primer `npm run etl`).
      return { fecha: new Date(0).toISOString(), total: 0, estado: "error" as const };
    }

    return {
      fecha: (fila.finalizado_en ?? fila.iniciado_en).toISOString(),
      total: fila.total_tickets ?? 0,
      estado: fila.estado === "exito" ? ("exito" as const) : ("error" as const),
    };
  });
}

interface FilaVTicket {
  clave: string;
  titulo_ticket: string | null;
  proyecto: string | null;
  fecha_creacion: Date;
  fecha_cierre: Date | null;
  fecha_actualizacion: Date;
  persona_asignada: string | null;
  persona_informadora: string | null;
  estado_ticket: string;
  categoria_estado: CategoriaEstado;
  prioridad: Prioridad;
  tipo_incidencia: string | null;
  tipo_requerimiento: string | null;
  sede: string | null;
  area_efectiva: string | null;
  comentarios: number;
  ttfr_horas: number | null;
  ttr_horas: number | null;
  ttfr_incumplido: boolean | null;
  ttr_incumplido: boolean | null;
  dias_sin_actualizar: number;
}

function mapearFila(f: FilaVTicket): Ticket {
  const { area, areaSlug, gerenciaSlug } = resolverArea(f.area_efectiva);
  const proyecto = f.proyecto ?? "";

  return {
    clave: f.clave,
    tituloTicket: f.titulo_ticket ?? "",
    proyecto,
    proyectoClave: claveDeProyecto.get(proyecto) ?? "",
    fechaCreacion: f.fecha_creacion.toISOString(),
    fechaCierre: f.fecha_cierre?.toISOString() ?? null,
    fechaActualizacion: f.fecha_actualizacion.toISOString(),
    personaAsignada: f.persona_asignada ?? "(Sin asignar)",
    informador: f.persona_informadora ?? "(Sin dato)",
    estadoTicket: f.estado_ticket,
    categoriaEstado: f.categoria_estado,
    prioridad: f.prioridad,
    tipoIncidencia: f.tipo_incidencia ?? "",
    tipoRequerimiento: f.tipo_requerimiento ?? "",
    sede: f.sede ?? "",
    area,
    areaSlug,
    gerenciaSlug,
    ttfrHoras: f.ttfr_horas,
    ttrHoras: f.ttr_horas,
    // NULL = SLA no trackeado para este ticket (ver CLAUDE.md § 9): no cuenta
    // como incumplido, igual que un ticket sin ttrHoras porque sigue abierto.
    ttfrIncumplido: f.ttfr_incumplido ?? false,
    ttrIncumplido: f.ttr_incumplido ?? false,
    comentarios: f.comentarios,
    diasSinActualizar: f.dias_sin_actualizar,
  };
}

/**
 * Lee `jira_cache.v_tickets` — nunca `tickets_raw` directo: la vista ya
 * resuelve el switch de Área por proyecto (SMM usa `dependencia_smm`, los
 * otros 11 usan `area`) y la categoría de estado normalizada.
 */
async function obtenerTicketsDesdeDB(): Promise<Ticket[]> {
  return conCliente(async (cliente) => {
    const r = await cliente.query<FilaVTicket>(
      `SELECT clave, titulo_ticket, proyecto, fecha_creacion, fecha_cierre, fecha_actualizacion,
              persona_asignada, persona_informadora, estado_ticket, categoria_estado, prioridad,
              tipo_incidencia, tipo_requerimiento, sede, area_efectiva, comentarios,
              ttfr_horas, ttr_horas, ttfr_incumplido, ttr_incumplido, dias_sin_actualizar
       FROM jira_cache.v_tickets
       ORDER BY fecha_creacion ASC`,
    );

    return r.rows.map(mapearFila);
  });
}
