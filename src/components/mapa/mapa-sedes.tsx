"use client";

import maplibregl, { type Map as MapaLibre, type Marker } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";

import { useTema } from "@/components/tema";
import type { DetalleSede } from "@/lib/sedes-detalle";

import { coloresSilueta, estiloMapa, usaMapTiler } from "./estilo";
import { PanelSede } from "./panel-sede";

import "maplibre-gl/dist/maplibre-gl.css";
import "./mapa.css";

const TODAS = "todas";

/**
 * Mapa de sedes.
 *
 * Cómo se selecciona una sede — las tres formas conviven a propósito:
 *  - **Hover** sobre un pin: muestra esa sede. Fue una corrección explícita de
 *    Alexis sobre el prototipo original, que usaba clic.
 *  - **Clic** sobre un pin (o su botón en la barra): la FIJA. Mientras hay una
 *    sede fijada el hover deja de mandar — si no, mover el mouse hacia el panel
 *    para leerlo cambiaría justo lo que estás leyendo.
 *  - **"Todas"**: vuelve a la vista consolidada de toda la operación.
 *
 * En pantallas sin hover real (celular, tablet) solo aplica el tap. Se detecta
 * con `matchMedia("(hover: hover)")`, no por ancho de pantalla — que es lo que
 * falla con laptops táctiles.
 */
export function MapaSedes({
  sedes,
  consolidado,
}: {
  sedes: DetalleSede[];
  consolidado: DetalleSede;
}) {
  const { tema } = useTema();
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLibre | null>(null);
  const marcadores = useRef<Marker[]>([]);
  const [listo, setListo] = useState(false);
  const [falloMapa, setFalloMapa] = useState(false);

  /** Selección fijada con clic. Arranca en la vista consolidada. */
  const [fijada, setFijada] = useState<string>(TODAS);
  /** Sede bajo el mouse. Solo manda si no hay nada fijado. */
  const [enHover, setEnHover] = useState<string | null>(null);

  const activa = fijada === TODAS ? (enHover ?? TODAS) : fijada;

  /**
   * Dibuja la silueta de Medellín (contorno real del municipio, OSM/ODbL).
   * Se extrae a función porque hay que volver a llamarla cada vez que cambia
   * el estilo del mapa: `setStyle()` borra todas las fuentes y capas.
   */
  const dibujarSilueta = useCallback(async (m: MapaLibre, temaActual: "claro" | "oscuro") => {
    if (m.getSource("medellin")) return;
    try {
      const res = await fetch("/geo/medellin.geojson");
      if (!res.ok) return;
      const c = coloresSilueta(temaActual);
      m.addSource("medellin", { type: "geojson", data: await res.json() });
      m.addLayer({
        id: "medellin-relleno",
        type: "fill",
        source: "medellin",
        paint: { "fill-color": c.relleno, "fill-opacity": c.opacidadRelleno },
      });
      m.addLayer({
        id: "medellin-borde",
        type: "line",
        source: "medellin",
        paint: { "line-color": c.borde, "line-width": 1.6, "line-opacity": c.opacidadBorde },
      });
    } catch {
      // Si la silueta no carga, el mapa sigue siendo perfectamente usable.
    }
  }, []);

  // Inicialización. Se monta una sola vez; el cambio de tema se maneja aparte.
  useEffect(() => {
    if (!contenedor.current || mapa.current) return;

    const m = new maplibregl.Map({
      container: contenedor.current,
      style: estiloMapa(tema),
      center: [-75.5766, 6.2442], // Medellín
      zoom: 10.6,
      attributionControl: { compact: true },
      // El mapa es un instrumento de lectura, no un explorador: sin rotación
      // se evita que alguien lo deje torcido y no sepa cómo enderezarlo.
      pitchWithRotate: false,
      dragRotate: false,
    });

    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.touchZoomRotate.disableRotation();

    m.on("load", () => {
      void dibujarSilueta(m, tema);
      setListo(true);
    });

    // Red de seguridad: si el evento `load` no llega (red corporativa que
    // bloquea las teselas de OpenStreetMap, proxy que las traga, WebGL
    // deshabilitado), sin esto el usuario se queda mirando "Cargando mapa…"
    // para siempre y no tiene forma de saber qué pasó. A los 8 segundos se
    // asume que falló y se muestra el motivo con qué hacer al respecto.
    const plazo = setTimeout(() => {
      setListo((ya) => {
        if (!ya) setFalloMapa(true);
        return ya;
      });
    }, 8000);

    // MapLibre mide su contenedor UNA vez al construirse. Si en ese instante el
    // layout de grid todavía no resolvió el ancho (pasa siempre en el primer
    // render), el canvas queda con un tamaño equivocado y se ve un mapa
    // diminuto en una esquina. El observer lo vuelve a medir cuando el
    // contenedor cambia — también cubre el resize de ventana.
    const observador = new ResizeObserver(() => m.resize());
    observador.observe(contenedor.current);

    mapa.current = m;
    return () => {
      clearTimeout(plazo);
      observador.disconnect();

      // Liberar el contexto WebGL explícitamente, no solo confiar en `remove()`.
      //
      // El navegador limita cuántos contextos WebGL vivos puede haber (~16 en
      // Chrome) y los recolecta con pereza. En desarrollo, entre StrictMode
      // (que monta, desmonta y vuelve a montar) y el hot reload, se crean
      // muchos mapas en la misma pestaña; al pasarse del límite, el mapa nuevo
      // se queda en negro y el evento `load` nunca llega — sin ningún error en
      // consola, que es lo que lo hace difícil de diagnosticar.
      const lienzo = m.getCanvas();
      m.remove();
      const gl = lienzo?.getContext("webgl2") ?? lienzo?.getContext("webgl");
      (gl?.getExtension("WEBGL_lose_context") as { loseContext?: () => void } | null)?.loseContext?.();

      mapa.current = null;
    };
    // Intencionalmente sin `tema`: el mapa no se re-crea al cambiar de tema.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cambio de tema.
  // Con MapTiler hay estilo oscuro de verdad, así que se cambia el estilo
  // completo (y hay que redibujar la silueta, porque `setStyle` la borra).
  // Sin MapTiler, OSM solo tiene teselas claras: el modo oscuro se logra con
  // un filtro CSS sobre el canvas, y acá solo hay que repintar la silueta.
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;

    if (usaMapTiler()) {
      m.setStyle(estiloMapa(tema));
      m.once("styledata", () => void dibujarSilueta(m, tema));
      return;
    }

    const c = coloresSilueta(tema);
    if (m.getLayer("medellin-relleno")) {
      m.setPaintProperty("medellin-relleno", "fill-color", c.relleno);
      m.setPaintProperty("medellin-relleno", "fill-opacity", c.opacidadRelleno);
      m.setPaintProperty("medellin-borde", "line-color", c.borde);
      m.setPaintProperty("medellin-borde", "line-opacity", c.opacidadBorde);
    }
  }, [tema, listo, dibujarSilueta]);

  // Pines: se re-crean si cambia el conjunto de sedes visibles (por ejemplo,
  // al entrar un coordinador con otros permisos).
  useEffect(() => {
    const m = mapa.current;
    if (!m || !listo) return;

    const hoverReal =
      typeof window !== "undefined" && window.matchMedia("(hover: hover)").matches;

    for (const sede of sedes) {
      const el = document.createElement("div");
      el.className = `mp-pin et-${sede.etiquetaPos}${sede.aproximado ? " aprox" : ""}`;
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", `Ver detalle de la sede ${sede.nombre}`);
      el.innerHTML = `
        <span class="mp-pin-onda"></span>
        <span class="mp-pin-nucleo"></span>
        <span class="mp-etiqueta">${sede.nombre}</span>
      `;

      const fijar = () => {
        setFijada(sede.slug);
        setEnHover(null);
      };

      if (hoverReal) {
        el.addEventListener("mouseenter", () => setEnHover(sede.slug));
        el.addEventListener("mouseleave", () => setEnHover(null));
      }
      el.addEventListener("click", fijar);
      // Teclado: el mapa no puede ser una trampa para quien no usa mouse.
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fijar();
        }
      });
      el.addEventListener("focus", () => setEnHover(sede.slug));
      el.addEventListener("blur", () => setEnHover(null));

      marcadores.current.push(
        new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([sede.lon, sede.lat])
          .addTo(m),
      );
    }

    if (sedes.length) {
      const limites = new maplibregl.LngLatBounds();
      sedes.forEach((s) => limites.extend([s.lon, s.lat]));
      m.fitBounds(limites, { padding: 90, maxZoom: 12.4, duration: 0 });
    }

    return () => {
      marcadores.current.forEach((mk) => mk.remove());
      marcadores.current = [];
    };
  }, [sedes, listo]);

  // Estado visual del pin. `activo` = lo que está en la tarjeta ahora mismo
  // (puede venir de un hover pasajero); `fijo` = lo que quedó seleccionado.
  useEffect(() => {
    marcadores.current.forEach((mk, i) => {
      const el = mk.getElement();
      el.classList.toggle("activo", sedes[i]?.slug === activa);
      el.classList.toggle("fijo", sedes[i]?.slug === fijada);
    });
  }, [activa, fijada, sedes]);

  /** Centra el mapa al seleccionar desde la barra de botones. */
  function seleccionarDesdeBarra(slug: string) {
    setFijada(slug);
    setEnHover(null);
    const m = mapa.current;
    if (!m) return;

    if (slug === TODAS) {
      if (!sedes.length) return;
      const limites = new maplibregl.LngLatBounds();
      sedes.forEach((s) => limites.extend([s.lon, s.lat]));
      m.fitBounds(limites, { padding: 90, maxZoom: 12.4, duration: 600 });
      return;
    }

    const sede = sedes.find((s) => s.slug === slug);
    if (sede) m.flyTo({ center: [sede.lon, sede.lat], zoom: 12.9, duration: 700 });
  }

  const detalle =
    activa === TODAS ? consolidado : (sedes.find((s) => s.slug === activa) ?? consolidado);
  const hayAproximada = sedes.some((s) => s.aproximado);

  return (
    <div className="mp-wrap">
      <div className="mp-panel">
        <div className="mp-selector" role="group" aria-label="Seleccionar sede">
          <button
            type="button"
            className={`mp-chip${fijada === TODAS ? " activo" : ""}`}
            onClick={() => seleccionarDesdeBarra(TODAS)}
            aria-pressed={fijada === TODAS}
          >
            Todas
          </button>
          {sedes.map((s) => (
            <button
              key={s.slug}
              type="button"
              className={`mp-chip${fijada === s.slug ? " activo" : ""}`}
              onClick={() => seleccionarDesdeBarra(s.slug)}
              onMouseEnter={() => fijada === TODAS && setEnHover(s.slug)}
              onMouseLeave={() => setEnHover(null)}
              aria-pressed={fijada === s.slug}
            >
              {s.nombre}
            </button>
          ))}
        </div>

        {/* El overlay de carga va DENTRO del contenedor del lienzo, no sobre
            el panel entero: si cubriera el panel taparía los botones de sede y
            no se podría elegir nada mientras el mapa arranca. */}
        <div className="mp-lienzo-caja">
          <div className={`mp-lienzo${usaMapTiler() ? " vectorial" : ""}`} ref={contenedor} />
          {!listo &&
            (falloMapa ? (
              <div className="mp-cargando mp-fallo">
                <strong>No se pudo cargar el mapa</strong>
                <span>
                  Revisa la conexión: las teselas vienen de tile.openstreetmap.org y algunas
                  redes corporativas lo bloquean. Los datos de las sedes siguen disponibles en
                  los botones de arriba y en el panel de la derecha.
                </span>
              </div>
            ) : (
              <div className="mp-cargando">Cargando mapa…</div>
            ))}
        </div>

        <div className="mp-pie">
          <span className="mp-leyenda">
            <span className="mp-muestra" /> Ubicación exacta
          </span>
          {hayAproximada && (
            <span className="mp-leyenda">
              <span className="mp-muestra aprox" /> Ubicación agrupada
            </span>
          )}
          <span>
            {fijada === TODAS
              ? "Pasa el mouse sobre un pin para verla · haz clic para fijarla"
              : "Sede fijada · usa «Todas» para volver a la vista general"}
          </span>
        </div>
      </div>

      <PanelSede detalle={detalle} esConsolidado={detalle.slug === TODAS} />
    </div>
  );
}
