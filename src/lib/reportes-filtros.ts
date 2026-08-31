/**
 * Traduce los query params de /reportes a `Filtros`.
 *
 * Vive separado de la página porque la exportación a PDF/Excel (Fase 2) tiene
 * que interpretar exactamente la misma URL que el usuario está viendo — si esta
 * lógica se duplicara en el endpoint de exportar, un cambio en un lado y no en
 * el otro haría que el archivo descargado no coincida con lo que hay en pantalla.
 */

import { areaPorSlug, gerenciaPorSlug, sedePorSlug } from "@/lib/catalogo";
import type { Filtros } from "@/lib/data/provider";

export type ReportesSearchParams = Record<string, string | string[] | undefined>;

const uno = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v || undefined;

export function filtrosDesdeSearchParams(sp: ReportesSearchParams): Filtros {
  return {
    gerencias: uno(sp.gerencia) ? [uno(sp.gerencia)!] : undefined,
    areas: uno(sp.area) ? [uno(sp.area)!] : undefined,
    sedes: uno(sp.sede) ? [uno(sp.sede)!] : undefined,
    personas: uno(sp.persona) ? [uno(sp.persona)!] : undefined,
    tiposRequerimiento: uno(sp.tipo) ? [uno(sp.tipo)!] : undefined,
    estado: (uno(sp.estado) as Filtros["estado"]) ?? "todos",
    // El input date da 'YYYY-MM-DD'; se normaliza a ISO para comparar contra
    // `fecha_creacion`. El 'hasta' incluye el día completo, si no se pierde
    // el último día del rango y nadie entiende por qué faltan tickets.
    desde: uno(sp.desde) ? `${uno(sp.desde)}T00:00:00.000Z` : undefined,
    hasta: uno(sp.hasta) ? `${uno(sp.hasta)}T23:59:59.999Z` : undefined,
    soloIncumplidos: uno(sp.rojo) === "1",
    soloEstancados: uno(sp.estancado) === "1",
  };
}

/** Texto legible de los filtros activos, para el encabezado del PDF/Excel exportado. */
export function describirFiltros(sp: ReportesSearchParams): string {
  const partes: string[] = [];
  const g = uno(sp.gerencia);
  const a = uno(sp.area);
  const s = uno(sp.sede);
  const p = uno(sp.persona);
  const t = uno(sp.tipo);
  const estado = uno(sp.estado);
  const desde = uno(sp.desde);
  const hasta = uno(sp.hasta);

  if (g) partes.push(`Gerencia: ${gerenciaPorSlug(g)?.nombre ?? g}`);
  if (a) partes.push(`Área: ${areaPorSlug(a)?.nombre ?? a}`);
  if (s) partes.push(`Sede: ${sedePorSlug(s)?.nombre ?? s}`);
  if (p) partes.push(`Persona: ${p}`);
  if (t) partes.push(`Tipo: ${t}`);
  if (estado && estado !== "todos") partes.push(`Estado: ${estado === "pendientes" ? "Pendientes" : "Resueltos"}`);
  if (desde) partes.push(`Desde ${desde}`);
  if (hasta) partes.push(`Hasta ${hasta}`);
  if (uno(sp.rojo) === "1") partes.push("Solo tickets en rojo");
  if (uno(sp.estancado) === "1") partes.push("Solo estancados (5+ días sin movimiento)");

  return partes.length ? partes.join(" · ") : "Sin filtros — todos los tickets visibles para el usuario";
}
