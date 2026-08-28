/**
 * Detalle por sede — lo que se muestra al pasar el mouse sobre un pin del mapa.
 *
 * El contenido lo definió Alexis en la sección 1 del doc: histórico
 * (año/mes/semana/día), total de tickets, pendientes, top 5 más antiguos sin
 * resolver, top 5 con más comentarios, tipo de requerimiento más solicitado y
 * portal de JSM más usado en esa sede.
 *
 * Se calcula en el servidor para las 6 sedes de una sola pasada y se manda ya
 * listo al cliente: así el hover es instantáneo (no dispara un fetch por pin)
 * y el mapa no necesita saber nada de negocio.
 */

import { SEDES, type Sede } from "@/lib/catalogo";
import { FECHA_CORTE, type Ticket } from "@/lib/demo/generador";
import {
  MESES_CORTOS,
  masAntiguosSinResolver,
  masComentados,
  modaDe,
  resumen,
  diasAbierto,
} from "@/lib/metricas";

export type Granularidad = "anio" | "mes" | "semana" | "dia";

const DIA_MS = 86_400_000;

/** Bogotá es UTC-5 fijo (no tiene horario de verano), así que basta el offset. */
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;

/** Número de día calendario en Bogotá al que pertenece un instante. */
function diaBogota(ms: number): number {
  return Math.floor((ms - OFFSET_BOGOTA_MS) / DIA_MS);
}

/**
 * Domingo = no laboral, así que no se grafica: una barra en cero por semana
 * solo mete ruido y hace ver caídas que no existen.
 * El día 0 de la época (1-ene-1970) fue jueves; de ahí el +4.
 */
function esDomingo(dia: number): boolean {
  return (dia + 4) % 7 === 0;
}

export interface PuntoHistorico {
  etiqueta: string;
  valor: number;
}

export interface TicketResumido {
  clave: string;
  titulo: string;
  valor: string;
  alerta: boolean;
}

export interface DetalleSede {
  slug: string;
  nombre: string;
  direccion: string;
  lat: number;
  lon: number;
  aproximado: boolean;
  etiquetaPos: "derecha" | "izquierda" | "arriba" | "abajo";
  total: number;
  pendientes: number;
  resueltos: number;
  promedioMensual: number;
  cumplimientoTtr: number;
  estancados: number;
  tipoMasSolicitado: string;
  portalMasUsado: string;
  areaMasPesada: string;
  masAntiguos: TicketResumido[];
  masComentados: TicketResumido[];
  historico: Record<Granularidad, PuntoHistorico[]>;
}

function historicoDe(tickets: Ticket[]): Record<Granularidad, PuntoHistorico[]> {
  // AÑO — con un solo año de datos igual dejamos la serie lista para cuando
  // haya histórico de varios años; no hay que tocar la UI después.
  const porAnio = new Map<number, number>();
  const porMes = new Array(12).fill(0);

  for (const t of tickets) {
    const f = new Date(t.fechaCreacion);
    porAnio.set(f.getUTCFullYear(), (porAnio.get(f.getUTCFullYear()) ?? 0) + 1);
    porMes[f.getUTCMonth()] += 1;
  }

  const mesTope = FECHA_CORTE.getUTCMonth();

  // SEMANA — las últimas 8 semanas contra la fecha de corte.
  const semanas: PuntoHistorico[] = [];
  for (let i = 7; i >= 0; i--) {
    const fin = FECHA_CORTE.getTime() - i * 7 * 86_400_000;
    const inicio = fin - 7 * 86_400_000;
    const valor = tickets.filter((t) => {
      const ms = new Date(t.fechaCreacion).getTime();
      return ms > inicio && ms <= fin;
    }).length;
    semanas.push({ etiqueta: i === 0 ? "Esta" : `-${i}`, valor });
  }

  // DÍA — el día de corte y los 13 días laborales anteriores (14 barras en
  // total), saltando los domingos. Se agrupa por día CALENDARIO de Bogotá, no
  // por ventanas de 24 h contra la hora de corte: si no, la etiqueta "21" podía
  // contener tickets creados el 20 por la tarde.
  const diaCorte = diaBogota(FECHA_CORTE.getTime());
  const diasLaborales: number[] = [];
  for (let d = diaCorte; diasLaborales.length < 14; d--) {
    if (!esDomingo(d)) diasLaborales.push(d);
  }
  diasLaborales.reverse();

  const creadosPorDia = new Map<number, number>();
  for (const t of tickets) {
    const d = diaBogota(new Date(t.fechaCreacion).getTime());
    creadosPorDia.set(d, (creadosPorDia.get(d) ?? 0) + 1);
  }

  const dias: PuntoHistorico[] = diasLaborales.map((d) => ({
    // Mediodía de ese día en Bogotá — evita que un redondeo caiga en el día vecino.
    etiqueta: new Date(d * DIA_MS + OFFSET_BOGOTA_MS + DIA_MS / 2).toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      day: "2-digit",
    }),
    valor: creadosPorDia.get(d) ?? 0,
  }));

  return {
    anio: [...porAnio.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([anio, valor]) => ({ etiqueta: String(anio), valor })),
    mes: MESES_CORTOS.slice(0, mesTope + 1).map((m, i) => ({ etiqueta: m, valor: porMes[i] })),
    semana: semanas,
    dia: dias,
  };
}

function detalleDeSede(sede: Sede, tickets: Ticket[]): DetalleSede {
  const r = resumen(tickets);

  return {
    slug: sede.slug,
    nombre: sede.nombre,
    direccion: sede.direccion,
    lat: sede.lat,
    lon: sede.lon,
    aproximado: Boolean(sede.aproximado),
    etiquetaPos: sede.etiqueta ?? "derecha",
    total: r.total,
    pendientes: r.pendientes,
    resueltos: r.resueltos,
    promedioMensual: r.promedioMensual,
    cumplimientoTtr: r.cumplimientoTtr,
    estancados: r.estancados,
    tipoMasSolicitado: modaDe(tickets, (t) => t.tipoRequerimiento),
    portalMasUsado: modaDe(
      tickets.filter((t) => t.categoriaEstado !== "resuelto"),
      (t) => t.proyecto,
    ),
    areaMasPesada: modaDe(tickets, (t) => t.area),
    masAntiguos: masAntiguosSinResolver(tickets, 5).map((t) => ({
      clave: t.clave,
      titulo: t.tituloTicket,
      valor: `${diasAbierto(t)} días`,
      alerta: true,
    })),
    masComentados: masComentados(tickets, 5).map((t) => ({
      clave: t.clave,
      titulo: t.tituloTicket,
      valor: `${t.comentarios} coment.`,
      alerta: t.comentarios >= 12,
    })),
    historico: historicoDe(tickets),
  };
}

/**
 * Vista consolidada "Todas las sedes".
 *
 * Es el estado por defecto del panel del mapa: al entrar, la pregunta primero
 * es "¿cómo va la operación?" y solo después "¿cómo va esta sede?". Usa
 * exactamente la misma estructura que una sede, así que el componente que la
 * pinta es el mismo — no hay una segunda tarjeta que mantener en paralelo.
 */
export function detalleConsolidado(tickets: Ticket[], cantidadSedes: number): DetalleSede {
  const base = detalleDeSede(
    {
      slug: "todas",
      nombre: "Todas las sedes",
      direccion: `Vista consolidada de ${cantidadSedes} ${cantidadSedes === 1 ? "sede" : "sedes"} · operación completa 2026`,
      lat: 0,
      lon: 0,
      peso: 1,
    },
    tickets,
  );
  return base;
}

/** Detalle de TODAS las sedes visibles para la sesión, en una sola pasada. */
export function detallePorSede(tickets: Ticket[]): DetalleSede[] {
  const grupos = new Map<string, Ticket[]>();
  for (const t of tickets) {
    const arr = grupos.get(t.sede);
    if (arr) arr.push(t);
    else grupos.set(t.sede, [t]);
  }

  return SEDES.filter((s) => (grupos.get(s.nombre)?.length ?? 0) > 0).map((s) =>
    detalleDeSede(s, grupos.get(s.nombre) ?? []),
  );
}
