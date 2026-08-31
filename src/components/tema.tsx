"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Tema = "claro" | "oscuro";

/** Oscuro por defecto: es un panel que se mira muchas horas seguidas. */
export const TEMA_POR_DEFECTO: Tema = "oscuro";
export const CLAVE_TEMA = "sitti-tema";

/**
 * Script que corre ANTES del primer paint.
 *
 * Va inline en el `<head>` a propósito: si el tema se aplicara desde React,
 * el navegador pintaría un frame con el tema equivocado y se vería un
 * "flashazo" blanco al entrar (o al recargar) en modo oscuro. Este script
 * escribe el atributo en `<html>` antes de que haya nada que pintar.
 */
export const SCRIPT_TEMA = `
(function () {
  try {
    var t = localStorage.getItem(${JSON.stringify(CLAVE_TEMA)});
    if (t !== "claro" && t !== "oscuro") t = ${JSON.stringify(TEMA_POR_DEFECTO)};
    document.documentElement.setAttribute("data-tema", t);
    document.documentElement.style.colorScheme = t === "oscuro" ? "dark" : "light";
  } catch (e) {
    document.documentElement.setAttribute("data-tema", ${JSON.stringify(TEMA_POR_DEFECTO)});
  }
})();
`;

interface ContextoTema {
  tema: Tema;
  alternar: () => void;
}

const Ctx = createContext<ContextoTema>({ tema: TEMA_POR_DEFECTO, alternar: () => {} });

export function ProveedorTema({ children }: { children: React.ReactNode }) {
  // Se inicializa con el valor por defecto, no leyendo `localStorage`: el
  // servidor no lo tiene y arrancar distinto rompería la hidratación. El
  // `useEffect` de abajo sincroniza con lo que ya escribió SCRIPT_TEMA.
  const [tema, setTema] = useState<Tema>(TEMA_POR_DEFECTO);

  useEffect(() => {
    const actual = document.documentElement.getAttribute("data-tema");
    if (actual === "claro" || actual === "oscuro") setTema(actual);
  }, []);

  const alternar = useCallback(() => {
    setTema((previo) => {
      const siguiente: Tema = previo === "oscuro" ? "claro" : "oscuro";
      document.documentElement.setAttribute("data-tema", siguiente);
      document.documentElement.style.colorScheme = siguiente === "oscuro" ? "dark" : "light";
      try {
        localStorage.setItem(CLAVE_TEMA, siguiente);
      } catch {
        // Modo incógnito o cookies bloqueadas: el tema igual funciona, solo no persiste.
      }
      return siguiente;
    });
  }, []);

  return <Ctx.Provider value={{ tema, alternar }}>{children}</Ctx.Provider>;
}

export const useTema = () => useContext(Ctx);

/** Paleta para lo que no se puede pintar con CSS (SVG de Recharts, mapa). */
export function paletaDe(tema: Tema) {
  return tema === "oscuro"
    ? {
        rejilla: "#2E3366",
        eje: "#9BA0C4",
        texto: "#EDEEF7",
        superficie: "#1B1F4A",
        borde: "#2E3366",
        serieA: "#ADB0EB",
        serieB: "#56C4C6",
      }
    : {
        rejilla: "#E4E5F0",
        eje: "#6B6E8C",
        texto: "#1B1D3A",
        superficie: "#FFFFFF",
        borde: "#E4E5F0",
        serieA: "#33357E",
        serieB: "#3FA9AC",
      };
}

export function BotonTema() {
  const { tema, alternar } = useTema();
  const oscuro = tema === "oscuro";

  return (
    <button
      type="button"
      className="sh-tema"
      onClick={alternar}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={oscuro ? "Modo claro" : "Modo oscuro"}
    >
      {oscuro ? (
        // Sol
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // Luna
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
