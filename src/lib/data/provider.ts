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

import { ticketsDemo, type Ticket } from "@/lib/demo/generador";
import { puedeVer, type Sesion } from "@/lib/auth/tipos";
import { SEDES } from "@/lib/catalogo";

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
  /** Único filtro de estado que pide el negocio para el eje "Área". */
  estado?: "todos" | "pendientes" | "resueltos";
  /** Solo tickets que ya incumplieron TTR o TTFR (el "en rojo"). */
  soloIncumplidos?: boolean;
}

export const DEMO_MODE = process.env.DEMO_MODE !== "false";

const slugDeSede = new Map(SEDES.map((s) => [s.nombre, s.slug]));

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
  if (f.soloIncumplidos && !(t.ttrIncumplido || t.ttfrIncumplido)) return false;

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

/** Metadatos del último sync, para el sello de "actualizado hace…" en la UI. */
export async function ultimaSincronizacion(): Promise<{ fecha: string; total: number; estado: "exito" | "error" }> {
  if (DEMO_MODE) {
    const { FECHA_CORTE } = await import("@/lib/demo/generador");
    return { fecha: FECHA_CORTE.toISOString(), total: ticketsDemo().length, estado: "exito" };
  }
  // Con datos reales: SELECT * FROM jira_cache.sync_log ORDER BY finalizado_en DESC LIMIT 1
  throw new Error("ultimaSincronizacion: falta implementar la lectura de jira_cache.sync_log");
}

/**
 * TODO (Alexis): implementar cuando exista la base.
 *
 * Pasos, en orden:
 *  1. `npm run db:schema` para crear los esquemas (ver `db/schema.sql`).
 *  2. Correr el ETL (`npm run etl`) para poblar `jira_cache.tickets_raw`.
 *  3. Reemplazar el `throw` de abajo por la consulta y poner `DEMO_MODE=false`.
 *
 * Ojo con el switch de área por proyecto — es la regla que más fácil se olvida:
 *   CASE WHEN proyecto = 'Mesa de ayuda SMM' THEN dependencia_smm ELSE area END
 */
async function obtenerTicketsDesdeDB(): Promise<Ticket[]> {
  throw new Error(
    "DEMO_MODE=false pero la lectura desde Postgres no está implementada todavía. " +
      "Ver docs/SETUP-ALEXIS.md § Conectar la base de datos.",
  );
}
