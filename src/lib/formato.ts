/**
 * Formato de números y fechas.
 *
 * Todo en español de Colombia: separador de miles con punto, decimal con coma,
 * fechas dd/mm. Se centraliza acá para que ninguna pantalla invente su propio
 * formato y el panel se vea consistente.
 *
 * Ojo: se fija la zona horaria a America/Bogota a propósito. Sin eso, el
 * servidor (que en Vercel corre en UTC) y el navegador del usuario podrían
 * renderizar días distintos para el mismo ticket.
 */

const ZONA = "America/Bogota";

export const numero = (n: number): string => n.toLocaleString("es-CO");

export const decimal = (n: number, digitos = 1): string =>
  n.toLocaleString("es-CO", { minimumFractionDigits: digitos, maximumFractionDigits: digitos });

export const porcentaje = (n: number): string => `${Math.round(n)}%`;

/** Horas en formato legible: 0,8 h · 3,5 h · 2 d 4 h */
export function horas(h: number | null): string {
  if (h === null) return "—";
  if (h < 24) return `${decimal(h)} h`;
  const dias = Math.floor(h / 24);
  const resto = Math.round(h % 24);
  return resto ? `${dias} d ${resto} h` : `${dias} d`;
}

export function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CO", {
    timeZone: ZONA,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** dd/mm HH:mm — para el sello de última sincronización. */
export function formatearFechaCorta(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function plural(n: number, singular: string, plural_: string): string {
  return n === 1 ? singular : plural_;
}
