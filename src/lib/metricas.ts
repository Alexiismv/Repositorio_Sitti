/**
 * Capa de métricas.
 *
 * Regla de diseño (viene del doc de requisitos, sección 7): las métricas NO se
 * pre-calculan ni se guardan como columnas. Se derivan siempre de la tabla
 * maestra de tickets aplicando los filtros activos. Estas funciones son el
 * equivalente en TypeScript de las consultas SQL que correrán contra
 * `jira_cache.tickets_raw` — misma agregación, mismo resultado.
 *
 * Área / Sede / Gerencia / Persona son EJES DE DESAGREGACIÓN del mismo par de
 * indicadores (TTR y TTFR), no métricas distintas por área.
 */

import {
  APLICATIVOS,
  AREAS,
  CATEGORIAS_BACKLOG,
  CATEGORIAS_ESTADO,
  DIAS_ESTANCADO_DEFAULT,
  GERENCIAS,
  META_TTFR_HORAS,
  META_TTR_HORAS,
  SEDES,
  type CategoriaEstado,
  type Prioridad,
} from "@/lib/catalogo";
import type { TicketBacklog } from "@/lib/demo/generador-backlog";
import { fechaCorte, type Ticket } from "@/lib/demo/generador";

export const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const abierto = (t: Ticket) => t.categoriaEstado !== "resuelto" && t.categoriaEstado !== "cancelado";

// ─────────────────────────────────────────────────────────────
// Resumen general
// ─────────────────────────────────────────────────────────────

export interface Resumen {
  total: number;
  pendientes: number;
  resueltos: number;
  cancelados: number;
  promedioMensual: number;
  /** % de tickets que respondieron dentro de las 4h de meta. */
  cumplimientoTtfr: number;
  /** % de tickets cerrados dentro de la meta de TTR según su prioridad. */
  cumplimientoTtr: number;
  ttfrPromedioHoras: number;
  ttrPromedioHoras: number;
  estancados: number;
}

export function resumen(tickets: Ticket[], diasEstancado = DIAS_ESTANCADO_DEFAULT): Resumen {
  const total = tickets.length;
  const resueltos = tickets.filter((t) => t.categoriaEstado === "resuelto").length;
  const cancelados = tickets.filter((t) => t.categoriaEstado === "cancelado").length;
  const pendientes = total - resueltos - cancelados;

  const conTtr = tickets.filter((t) => t.ttrHoras !== null);
  const conTtfr = tickets.filter((t) => t.ttfrHoras !== null);
  const ttfrOk = conTtfr.filter((t) => !t.ttfrIncumplido).length;
  const ttrOk = conTtr.filter((t) => !t.ttrIncumplido).length;

  // Meses con actividad — el promedio mensual se divide entre esos, no entre 12,
  // si no daría un promedio artificialmente bajo a mitad de año.
  const meses = new Set(tickets.map((t) => new Date(t.fechaCreacion).getUTCMonth()));

  return {
    total,
    pendientes,
    resueltos,
    cancelados,
    promedioMensual: meses.size ? Math.round(total / meses.size) : 0,
    cumplimientoTtfr: conTtfr.length ? Math.round((ttfrOk / conTtfr.length) * 100) : 0,
    cumplimientoTtr: conTtr.length ? Math.round((ttrOk / conTtr.length) * 100) : 0,
    ttfrPromedioHoras: conTtfr.length
      ? redondear(conTtfr.reduce((a, t) => a + (t.ttfrHoras ?? 0), 0) / conTtfr.length)
      : 0,
    ttrPromedioHoras: conTtr.length
      ? redondear(conTtr.reduce((a, t) => a + (t.ttrHoras ?? 0), 0) / conTtr.length)
      : 0,
    estancados: tickets.filter((t) => abierto(t) && t.diasSinActualizar >= diasEstancado).length,
  };
}

const redondear = (n: number) => Math.round(n * 10) / 10;

/**
 * Semáforo AGREGADO — no confundir con `semaforo()` más abajo, que es por
 * ticket individual (rojo si incumplió, amarillo si va cerca del límite).
 * Este clasifica un % de cumplimiento de un grupo entero (una prioridad, un
 * indicador). Cortes: verde ≥90%, amarillo ≥80%, rojo <80% — los mismos que
 * ya usa el resto del panel para marcar "en rojo si <80".
 */
export function semaforoDeCumplimiento(cumplimiento: number): "verde" | "amarillo" | "rojo" {
  return cumplimiento >= 90 ? "verde" : cumplimiento >= 80 ? "amarillo" : "rojo";
}

/** Cumplimiento de TTR desagregado por prioridad, cada una contra su propia meta. */
export interface TtrPorPrioridad {
  prioridad: Prioridad;
  metaHoras: number;
  promedioHoras: number;
  /** % de tickets de esa prioridad que cumplió su meta. */
  cumplimiento: number;
  semaforo: "verde" | "amarillo" | "rojo";
}

export function cumplimientoTtrPorPrioridad(tickets: Ticket[]): TtrPorPrioridad[] {
  return (["Alta", "Media", "Baja"] as Prioridad[]).map((prioridad) => {
    const grupo = tickets.filter((t) => t.prioridad === prioridad && t.ttrHoras !== null);
    const metaHoras = META_TTR_HORAS[prioridad];
    const ok = grupo.filter((t) => !t.ttrIncumplido).length;
    const cumplimiento = grupo.length ? Math.round((ok / grupo.length) * 100) : 0;
    const promedioHoras = grupo.length
      ? redondear(grupo.reduce((a, t) => a + (t.ttrHoras ?? 0), 0) / grupo.length)
      : 0;
    return {
      prioridad,
      metaHoras,
      promedioHoras,
      cumplimiento,
      semaforo: semaforoDeCumplimiento(cumplimiento),
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Series temporales
// ─────────────────────────────────────────────────────────────

export interface PuntoMes {
  mes: string;
  creados: number;
  resueltos: number;
}

/** Creados vs. resueltos por mes — la vista clásica de throughput/backlog. */
export function porMes(tickets: Ticket[]): PuntoMes[] {
  const creados = new Array(12).fill(0);
  const resueltos = new Array(12).fill(0);

  for (const t of tickets) {
    creados[new Date(t.fechaCreacion).getUTCMonth()] += 1;
    if (t.fechaCierre) resueltos[new Date(t.fechaCierre).getUTCMonth()] += 1;
  }

  const ultimoMes = fechaCorte().getUTCMonth();
  return MESES_CORTOS.slice(0, ultimoMes + 1).map((mes, i) => ({
    mes,
    creados: creados[i],
    resueltos: resueltos[i],
  }));
}

export interface PuntoSemana {
  /** Etiqueta del eje X: el día en que cierra esa semana ("20 Ago"). */
  semana: string;
  /** Rango completo de la semana, para el tooltip ("14 Ago – 20 Ago"). */
  rango: string;
  creados: number;
  resueltos: number;
}

/** Bogotá es UTC-5 fijo (no tiene horario de verano), así que basta el offset. */
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;

/**
 * "20 Ago" — la fecha como se ve en Bogotá.
 *
 * Se corre el instante -5 h y se leen las partes UTC: así la fecha no depende
 * de la zona horaria del servidor ni de la versión de ICU, y reutiliza los
 * mismos meses cortos que el resto del tablero.
 */
function fechaCorta(ms: number): string {
  const bogota = new Date(ms - OFFSET_BOGOTA_MS);
  return `${bogota.getUTCDate()} ${MESES_CORTOS[bogota.getUTCMonth()]}`;
}

/**
 * Últimas N semanas, para el comparativo semana vs. semana.
 *
 * El eje va con fechas reales y no con `S-0 / S-1 / S-7`: la sigla obligaba a
 * traducir mentalmente cada barra a un calendario, y nadie sabía de qué semana
 * estaba hablando el gráfico. El conteo no cambió, solo el rótulo.
 */
export function porSemana(tickets: Ticket[], semanas = 8): PuntoSemana[] {
  const finSemanaActual = fechaCorte().getTime();
  const puntos: PuntoSemana[] = [];

  for (let i = semanas - 1; i >= 0; i--) {
    const fin = finSemanaActual - i * 7 * 86_400_000;
    const inicio = fin - 7 * 86_400_000;
    const dentro = (iso: string | null) => {
      if (!iso) return false;
      const ms = new Date(iso).getTime();
      return ms > inicio && ms <= fin;
    };
    puntos.push({
      semana: i === 0 ? "Esta sem." : fechaCorta(fin),
      // La ventana es (inicio, fin]: el primer día contado es el siguiente a `inicio`.
      rango: `${fechaCorta(inicio + 1)} – ${fechaCorta(fin)}`,
      creados: tickets.filter((t) => dentro(t.fechaCreacion)).length,
      resueltos: tickets.filter((t) => dentro(t.fechaCierre)).length,
    });
  }
  return puntos;
}

// ─────────────────────────────────────────────────────────────
// Desagregaciones
// ─────────────────────────────────────────────────────────────

export interface FilaAgrupada {
  slug: string;
  nombre: string;
  total: number;
  pendientes: number;
  resueltos: number;
  cumplimientoTtr: number;
  incumplidos: number;
  color?: string;
}

function agrupar(
  tickets: Ticket[],
  claveDe: (t: Ticket) => string,
): Map<string, Ticket[]> {
  const mapa = new Map<string, Ticket[]>();
  for (const t of tickets) {
    const k = claveDe(t);
    const arr = mapa.get(k);
    if (arr) arr.push(t);
    else mapa.set(k, [t]);
  }
  return mapa;
}

function filaDe(slug: string, nombre: string, grupo: Ticket[], color?: string): FilaAgrupada {
  const r = resumen(grupo);
  return {
    slug,
    nombre,
    total: r.total,
    pendientes: r.pendientes,
    resueltos: r.resueltos,
    cumplimientoTtr: r.cumplimientoTtr,
    incumplidos: grupo.filter((t) => t.ttrIncumplido || t.ttfrIncumplido).length,
    color,
  };
}

/** Nivel 1 del flujo de navegación: ranking de gerencias por volumen. */
export function porGerencia(tickets: Ticket[]): FilaAgrupada[] {
  const grupos = agrupar(tickets, (t) => t.gerenciaSlug);
  return GERENCIAS.map((g) => filaDe(g.slug, g.nombre, grupos.get(g.slug) ?? [], g.color))
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Nivel 2: áreas dentro de una gerencia (o todas, si no se pasa gerencia). */
export function porArea(tickets: Ticket[]): FilaAgrupada[] {
  const grupos = agrupar(tickets, (t) => t.areaSlug);
  return AREAS.map((a) => {
    const gerencia = GERENCIAS.find((g) => g.slug === a.gerencia);
    return filaDe(a.slug, a.nombre, grupos.get(a.slug) ?? [], gerencia?.color);
  })
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total);
}

export function porSede(tickets: Ticket[]): FilaAgrupada[] {
  const grupos = agrupar(tickets, (t) => t.sede);
  return SEDES.map((s) => filaDe(s.slug, s.nombre, grupos.get(s.nombre) ?? []))
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Desagregado por persona — para que gerencia/coordinación audite a su equipo. */
export function porPersona(tickets: Ticket[]): (FilaAgrupada & { ttrPromedio: number; estancados: number })[] {
  const grupos = agrupar(tickets, (t) => t.personaAsignada);
  return [...grupos.entries()]
    .map(([persona, grupo]) => {
      const r = resumen(grupo);
      return {
        ...filaDe(persona, persona, grupo),
        ttrPromedio: r.ttrPromedioHoras,
        estancados: r.estancados,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function porTipoRequerimiento(tickets: Ticket[]): FilaAgrupada[] {
  const grupos = agrupar(tickets, (t) => t.tipoRequerimiento);
  return [...grupos.entries()]
    .map(([tipo, grupo]) => filaDe(tipo, tipo, grupo))
    .sort((a, b) => b.total - a.total);
}

export function porProyecto(tickets: Ticket[]): FilaAgrupada[] {
  const grupos = agrupar(tickets, (t) => t.proyecto);
  return [...grupos.entries()]
    .map(([p, grupo]) => filaDe(p, p, grupo))
    .sort((a, b) => b.total - a.total);
}

/**
 * Nivel 1 del módulo "Aplicativos": ranking por volumen operativo, sobre
 * `APLICATIVOS` (catalogo.ts) — no `PROYECTOS` directo, porque incluye
 * aplicativos que solo tienen backlog (Logística, MVI) y no tienen tickets
 * operativos que agrupar. Esos se conservan igual en la lista (`total = 0`)
 * porque sí tienen backlog que mostrar — se filtran solo los que no tienen
 * NI tickets NI backlog.
 */
export function porAplicativo(tickets: Ticket[]): FilaAgrupada[] {
  const grupos = agrupar(tickets, (t) => t.proyectoClave);
  return APLICATIVOS.map((a) =>
    filaDe(a.clave, a.nombre, a.proyecto ? (grupos.get(a.proyecto.clave) ?? []) : [], a.color),
  )
    .filter((f, i) => f.total > 0 || Boolean(APLICATIVOS[i].claveBacklog))
    .sort((a, b) => b.total - a.total);
}

// ─────────────────────────────────────────────────────────────
// Listas operativas (Nivel 3 y detalle de sede)
// ─────────────────────────────────────────────────────────────

/** Tickets abiertos ordenados por antigüedad — el "top 5 más viejos sin resolver". */
export function masAntiguosSinResolver(tickets: Ticket[], limite = 5): Ticket[] {
  return tickets
    .filter(abierto)
    .sort((a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime())
    .slice(0, limite);
}

/** Proxy de casos complejos/escalados: hilos con muchos comentarios. */
export function masComentados(tickets: Ticket[], limite = 5): Ticket[] {
  return [...tickets].sort((a, b) => b.comentarios - a.comentarios).slice(0, limite);
}

/** Abiertos sin movimiento hace >= N días. */
export function estancados(tickets: Ticket[], dias = DIAS_ESTANCADO_DEFAULT, limite?: number): Ticket[] {
  const lista = tickets
    .filter((t) => abierto(t) && t.diasSinActualizar >= dias)
    .sort((a, b) => b.diasSinActualizar - a.diasSinActualizar);
  return limite ? lista.slice(0, limite) : lista;
}

export function diasAbierto(t: Ticket): number {
  return Math.floor((fechaCorte().getTime() - new Date(t.fechaCreacion).getTime()) / 86_400_000);
}

/** Tablero del Nivel 3: columnas = categorías normalizadas de estado. */
export function tableroEstados(tickets: Ticket[]): { categoria: CategoriaEstado; label: string; color: string; tickets: Ticket[] }[] {
  return CATEGORIAS_ESTADO.map((c) => ({
    categoria: c.key,
    label: c.label,
    color: c.color,
    tickets: tickets
      .filter((t) => t.categoriaEstado === c.key)
      .sort((a, b) => b.diasSinActualizar - a.diasSinActualizar),
  }));
}

// ─────────────────────────────────────────────────────────────
// Tablero Kanban — forma genérica que consume <TableroKanban>
// ─────────────────────────────────────────────────────────────

/** Lo mínimo que necesita una tarjeta del tablero, sin importar si es un ticket operativo o un ítem de backlog. */
export interface TicketTablero {
  clave: string;
  tituloTicket: string;
  estadoTicket: string;
  diasSinActualizar: number;
  /** Estado final (no se muestra "Xd sin mover" — ya no aplica). */
  terminal: boolean;
}

export interface ColumnaTablero {
  categoria: string;
  label: string;
  color: string;
  tickets: TicketTablero[];
}

function aTicketTablero(t: Ticket, terminal: boolean): TicketTablero {
  return {
    clave: t.clave,
    tituloTicket: t.tituloTicket,
    estadoTicket: t.estadoTicket,
    diasSinActualizar: t.diasSinActualizar,
    terminal,
  };
}

/**
 * Columnas del tablero operativo (Pendiente / En progreso / En espera
 * proveedor / Resueltos-Cancelados) — 4 columnas de presentación sobre las 5
 * categorías de `tableroEstados()`. Resuelto y Cancelado se combinan acá
 * solo para mostrar, nunca en el modelo de datos (CLAUDE.md §2.1.3).
 */
export function columnasOperacion(tickets: Ticket[]): ColumnaTablero[] {
  const tablero = tableroEstados(tickets);
  const resueltoCol = tablero.find((c) => c.categoria === "resuelto");
  const canceladoCol = tablero.find((c) => c.categoria === "cancelado");

  const otras = tablero
    .filter((c) => c.categoria !== "resuelto" && c.categoria !== "cancelado")
    .map((c) => ({
      categoria: c.categoria as string,
      label: c.label,
      color: c.color,
      tickets: c.tickets.map((t) => aTicketTablero(t, false)),
    }));

  const combinada: ColumnaTablero = {
    categoria: "resueltos-cancelados",
    label: "Resueltos/Cancelados",
    color: resueltoCol?.color ?? "#3FA9AC",
    tickets: [...(resueltoCol?.tickets ?? []), ...(canceladoCol?.tickets ?? [])].map((t) =>
      aTicketTablero(t, true),
    ),
  };

  return [...otras, combinada];
}

/**
 * Columnas del tablero de backlog de desarrollo (6 categorías, ver la nota
 * de Fase 1/Fase 2 junto a `CATEGORIAS_BACKLOG` en `catalogo.ts`).
 */
export function columnasBacklog(items: TicketBacklog[]): ColumnaTablero[] {
  return CATEGORIAS_BACKLOG.map((c) => ({
    categoria: c.key,
    label: c.label,
    color: c.color,
    tickets: items
      .filter((i) => i.categoriaBacklog === c.key)
      .sort((a, b) => b.diasSinActualizar - a.diasSinActualizar)
      .map((i) => ({
        clave: i.clave,
        tituloTicket: i.tituloTicket,
        estadoTicket: i.estadoTicket,
        diasSinActualizar: i.diasSinActualizar,
        terminal: c.key === "produccion-cancelado",
      })),
  }));
}

export interface ResumenBacklog {
  total: number;
  activos: number;
  estancados: number;
  enProduccion: number;
}

/** KPIs del panel de backlog — sin TTR/TTFR: esas metas de SLA son del tablero operativo, no aplican a trabajo interno de desarrollo. */
export function resumenBacklog(items: TicketBacklog[], diasEstancado = DIAS_ESTANCADO_DEFAULT): ResumenBacklog {
  const total = items.length;
  const enProduccion = items.filter((i) => i.categoriaBacklog === "produccion-cancelado").length;
  const estancados = items.filter(
    (i) => i.categoriaBacklog !== "produccion-cancelado" && i.diasSinActualizar >= diasEstancado,
  ).length;

  return { total, activos: total - enProduccion, estancados, enProduccion };
}

/**
 * `resumenBacklog()` de cada aplicativo, agrupado — para el Nivel 1 de
 * Aplicativos: los que no tienen ticket operativo propio (Logística, MVI)
 * necesitan mostrar algo en su tarjeta de ranking, y lo único que tienen es
 * backlog.
 */
export function backlogPorAplicativo(items: TicketBacklog[]): Map<string, ResumenBacklog> {
  const grupos = new Map<string, TicketBacklog[]>();
  for (const it of items) {
    const arr = grupos.get(it.aplicativoClave);
    if (arr) arr.push(it);
    else grupos.set(it.aplicativoClave, [it]);
  }

  const resultado = new Map<string, ResumenBacklog>();
  for (const [clave, grupo] of grupos) resultado.set(clave, resumenBacklog(grupo));
  return resultado;
}

/** El valor más frecuente de un campo — "tipo más solicitado", "portal más usado". */
export function modaDe(tickets: Ticket[], campo: (t: Ticket) => string): string {
  if (!tickets.length) return "—";
  const conteo = new Map<string, number>();
  for (const t of tickets) {
    const k = campo(t);
    conteo.set(k, (conteo.get(k) ?? 0) + 1);
  }
  return [...conteo.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Semáforo de un ticket contra sus metas de SLA. */
export function semaforo(t: Ticket): "verde" | "amarillo" | "rojo" {
  if (t.ttfrIncumplido || t.ttrIncumplido) return "rojo";
  const metaTtr = META_TTR_HORAS[t.prioridad];
  const cercaTtfr = t.ttfrHoras !== null && t.ttfrHoras > META_TTFR_HORAS * 0.75;
  const cercaTtr = t.ttrHoras !== null && t.ttrHoras > metaTtr * 0.75;
  return cercaTtfr || cercaTtr ? "amarillo" : "verde";
}
