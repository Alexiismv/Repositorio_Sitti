/**
 * Generador de datos DEMO para el tablero de backlog de desarrollo del
 * módulo Aplicativos (Fase 1). Mismo espíritu que `generador.ts`: PRNG
 * semillado y determinístico, sin `Math.random()` ni `Date.now()`.
 *
 * Es un archivo aparte porque el backlog es una entidad distinta de
 * `Ticket` — vive en el proyecto JSM "* - Backlog" de cada aplicativo, no en
 * el proyecto "* - Tickets" que ya sincroniza `generador.ts`/el ETL real.
 * Ver la nota de Fase 1/Fase 2 junto a `CATEGORIAS_BACKLOG` en `catalogo.ts`.
 */

import { CATEGORIAS_BACKLOG, PROYECTOS, type CategoriaBacklog } from "@/lib/catalogo";
import { elegirPonderado, enteroEntre, fechaCorte, hashSemilla, mulberry32 } from "@/lib/demo/generador";

export interface TicketBacklog {
  clave: string;
  tituloTicket: string;
  /** Clave del aplicativo (= `Proyecto.clave` del proyecto operativo, ver Fase 1/Fase 2 en catalogo.ts). */
  aplicativoClave: string;
  estadoTicket: string; // literal (demo)
  categoriaBacklog: CategoriaBacklog;
  fechaCreacion: string; // ISO
  /** Días sin actualización a la fecha de corte. 0 para ítems en categoría terminal. */
  diasSinActualizar: number;
}

const TITULOS_BACKLOG = [
  "Ajuste de flujo de aprobación de {p}",
  "Nuevo reporte para {p}",
  "Integración con pasarela de pagos",
  "Optimización de tiempos de carga",
  "Corrección de error en formulario de {p}",
  "Automatización de notificaciones",
  "Rediseño de pantalla principal de {p}",
  "Nuevo campo solicitado por el negocio",
  "Migración de componente legado",
  "Mejora de accesibilidad",
  "Ajuste de integración con Quipux",
  "Nuevo indicador para el panel de {p}",
];

/** Pipeline de desarrollo: más carga al inicio del embudo, menos al final. */
const PESOS_CATEGORIA = [22, 18, 20, 14, 10, 16];

function generarBacklogDeAplicativo(proyecto: (typeof PROYECTOS)[number], corte: Date): TicketBacklog[] {
  const rng = mulberry32(hashSemilla(`backlog:${proyecto.clave}`));
  const cantidad = enteroEntre(rng, 10, 35);
  const items: TicketBacklog[] = [];

  for (let i = 1; i <= cantidad; i++) {
    const categoria = elegirPonderado(
      rng,
      CATEGORIAS_BACKLOG.map((c) => c.key),
      PESOS_CATEGORIA,
    );
    const info = CATEGORIAS_BACKLOG.find((c) => c.key === categoria)!;
    const terminal = categoria === "produccion-cancelado";

    const diasAntiguedad = enteroEntre(rng, 1, 220);
    const diasSinActualizar = terminal ? 0 : enteroEntre(rng, 0, Math.min(diasAntiguedad, 70));
    const fechaCreacion = new Date(corte.getTime() - diasAntiguedad * 86_400_000);

    const titulo = TITULOS_BACKLOG[Math.floor(rng() * TITULOS_BACKLOG.length)].replace(
      "{p}",
      proyecto.nombre.toLowerCase(),
    );

    items.push({
      clave: `${proyecto.clave}-BL-${100 + i}`,
      tituloTicket: titulo,
      aplicativoClave: proyecto.clave,
      estadoTicket: info.label.toUpperCase(),
      categoriaBacklog: categoria,
      fechaCreacion: fechaCreacion.toISOString(),
      diasSinActualizar,
    });
  }

  return items;
}

let cache: TicketBacklog[] | null = null;

/** Dataset demo completo de backlog (todos los aplicativos). Se genera una sola vez por proceso. */
export function ticketsBacklogDemo(): TicketBacklog[] {
  if (cache) return cache;
  const corte = fechaCorte();
  cache = PROYECTOS.flatMap((p) => generarBacklogDeAplicativo(p, corte));
  return cache;
}
