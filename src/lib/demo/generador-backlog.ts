/**
 * Generador de datos DEMO para el tablero de backlog de desarrollo del
 * módulo Aplicativos. Mismo espíritu que `generador.ts`: PRNG semillado y
 * determinístico, sin `Math.random()` ni `Date.now()`.
 *
 * Es un archivo aparte porque el backlog es una entidad distinta de
 * `Ticket` — vive en el proyecto JSM "* - Backlog" de cada aplicativo, no en
 * el proyecto "* - Tickets" que ya sincroniza `generador.ts`/el ETL real.
 * Ver la nota de Fase 1/Fase 2 junto a `CATEGORIAS_BACKLOG` en `catalogo.ts`.
 *
 * El vocabulario de estados (`ESTADO_A_CATEGORIA_BACKLOG`) ya es el REAL
 * confirmado por Alexis contra Jira — lo único inventado acá son los
 * títulos y las cantidades, mientras no exista el ETL real (Fase 2).
 */

import {
  APLICATIVOS,
  ESTADO_A_CATEGORIA_BACKLOG,
  type Aplicativo,
  type CategoriaBacklog,
} from "@/lib/catalogo";
import { elegirPonderado, enteroEntre, fechaCorte, hashSemilla, mulberry32 } from "@/lib/demo/generador";

export interface TicketBacklog {
  clave: string;
  tituloTicket: string;
  /** Clave del aplicativo (`Aplicativo.clave`, catalogo.ts) — no necesariamente tiene proyecto operativo. */
  aplicativoClave: string;
  estadoTicket: string; // literal REAL de Jira (ver ESTADO_A_CATEGORIA_BACKLOG en catalogo.ts)
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

/** Estados literales reales agrupados por categoría — varios estados caen en la misma (ver la nota en catalogo.ts). */
const LITERALES_POR_CATEGORIA: Record<CategoriaBacklog, string[]> = (() => {
  const mapa = {} as Record<CategoriaBacklog, string[]>;
  for (const [literal, categoria] of Object.entries(ESTADO_A_CATEGORIA_BACKLOG)) {
    (mapa[categoria] ??= []).push(literal);
  }
  return mapa;
})();

const APLICATIVOS_CON_BACKLOG = APLICATIVOS.filter((a) => a.claveBacklog);

function generarBacklogDeAplicativo(aplicativo: Aplicativo, corte: Date): TicketBacklog[] {
  const rng = mulberry32(hashSemilla(`backlog:${aplicativo.claveBacklog}`));
  const cantidad = enteroEntre(rng, 10, 35);
  const items: TicketBacklog[] = [];

  for (let i = 1; i <= cantidad; i++) {
    const categoria = elegirPonderado(
      rng,
      Object.keys(LITERALES_POR_CATEGORIA) as CategoriaBacklog[],
      PESOS_CATEGORIA,
    );
    const literales = LITERALES_POR_CATEGORIA[categoria];
    const estadoTicket = literales[Math.floor(rng() * literales.length)];
    const terminal = categoria === "produccion-cancelado";

    const diasAntiguedad = enteroEntre(rng, 1, 220);
    const diasSinActualizar = terminal ? 0 : enteroEntre(rng, 0, Math.min(diasAntiguedad, 70));
    const fechaCreacion = new Date(corte.getTime() - diasAntiguedad * 86_400_000);

    const titulo = TITULOS_BACKLOG[Math.floor(rng() * TITULOS_BACKLOG.length)].replace(
      "{p}",
      aplicativo.nombre.toLowerCase(),
    );

    items.push({
      clave: `${aplicativo.claveBacklog}-${100 + i}`,
      tituloTicket: titulo,
      aplicativoClave: aplicativo.clave,
      estadoTicket,
      categoriaBacklog: categoria,
      fechaCreacion: fechaCreacion.toISOString(),
      diasSinActualizar,
    });
  }

  return items;
}

let cache: TicketBacklog[] | null = null;

/** Dataset demo completo de backlog (solo aplicativos con `claveBacklog`). Se genera una sola vez por proceso. */
export function ticketsBacklogDemo(): TicketBacklog[] {
  if (cache) return cache;
  const corte = fechaCorte();
  cache = APLICATIVOS_CON_BACKLOG.flatMap((a) => generarBacklogDeAplicativo(a, corte));
  return cache;
}
