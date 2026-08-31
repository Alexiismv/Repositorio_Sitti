import type { StyleSpecification } from "maplibre-gl";

import type { Tema } from "@/components/tema";

/**
 * Estilo del mapa — "free maps", sin llaves de pago.
 *
 * Dos caminos, y el orden importa:
 *
 *  1. SIN configurar nada (lo que ve cualquiera al clonar el repo): teselas
 *     raster de OpenStreetMap. Cero cuenta, cero API key, funciona al instante.
 *     Limitación real: la política de uso de `tile.openstreetmap.org` es para
 *     tráfico bajo y no promete disponibilidad. Con ~15 usuarios va bien, pero
 *     NO es la opción correcta para dejarla en producción sin avisar.
 *
 *  2. CON `NEXT_PUBLIC_MAPTILER_KEY` (plan gratuito de MapTiler, 100k teselas
 *     al mes): estilo vectorial, más limpio, con términos de uso pensados para
 *     apps, y con variante oscura de verdad. Es el camino recomendado para el
 *     deploy en Vercel. Cómo sacar la llave: `CLAUDE.md` §6.
 *
 * En ambos casos la atribución se mantiene: es obligatoria por la licencia
 * ODbL de OpenStreetMap, no es cosmética.
 */

const ATRIBUCION_OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const usaMapTiler = (): boolean => Boolean(process.env.NEXT_PUBLIC_MAPTILER_KEY);

export function estiloMapa(tema: Tema): string | StyleSpecification {
  const llave = process.env.NEXT_PUBLIC_MAPTILER_KEY;

  if (llave) {
    // `dataviz` es casi monocromo: deja que los pines y la silueta de Medellín
    // sean lo que se ve, no las calles.
    const estilo = tema === "oscuro" ? "dataviz-dark" : "dataviz-light";
    return `https://api.maptiler.com/maps/${estilo}/style.json?key=${llave}`;
  }

  // OSM no publica variante oscura. En modo oscuro las teselas se invierten
  // con un filtro CSS sobre el canvas (ver `--mapa-filtro` en globals.css);
  // acá solo se ajusta el fondo para que el borde del lienzo no delate el
  // color equivocado mientras cargan las teselas.
  const fondo = tema === "oscuro" ? "#e8e9f2" : "#f7f8fb";

  return {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: ATRIBUCION_OSM,
      },
    },
    layers: [
      { id: "fondo", type: "background", paint: { "background-color": fondo } },
      {
        id: "osm",
        type: "raster",
        source: "osm",
        paint: {
          // Bajamos saturación y subimos brillo: el basemap es contexto, no
          // protagonista — los pines tienen que ganar visualmente.
          "raster-saturation": -0.78,
          "raster-contrast": -0.12,
          "raster-brightness-min": 0.12,
          "raster-opacity": 0.85,
        },
      },
    ],
  } satisfies StyleSpecification;
}

/**
 * Colores de la silueta de Medellín según el tema.
 * Van acá y no en CSS porque son propiedades `paint` de MapLibre, que se
 * escriben en el estilo del mapa y no leen variables CSS.
 */
export function coloresSilueta(tema: Tema) {
  return tema === "oscuro"
    ? { relleno: "#9C9FE3", opacidadRelleno: 0.1, borde: "#9C9FE3", opacidadBorde: 0.7 }
    : { relleno: "#33357E", opacidadRelleno: 0.06, borde: "#33357E", opacidadBorde: 0.55 };
}
