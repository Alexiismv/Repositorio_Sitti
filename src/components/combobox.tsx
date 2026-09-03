"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export interface OpcionCombobox {
  valor: string;
  nombre: string;
}

/**
 * Combobox "Buscar o Seleccionar" de selección única (spec 1.1/2.1: filtros
 * de Cargo/Sede y el dropdown Cargo del formulario). Input con filtro +
 * lista desplegable — distinto de `MultiSelectCheckbox`, que es de varias.
 */
export function Combobox({
  opciones,
  valor,
  onChange,
  placeholder = "Buscar o Seleccionar",
  permitirVacio = true,
  etiquetaVacio = "Todos",
  disabled,
}: {
  opciones: OpcionCombobox[];
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Si true, ofrece una opción para limpiar la selección (filtros). */
  permitirVacio?: boolean;
  etiquetaVacio?: string;
  disabled?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function alClicFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
        setBusqueda("");
      }
    }
    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, [abierto]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return opciones;
    return opciones.filter((o) => o.nombre.toLowerCase().includes(q));
  }, [opciones, busqueda]);

  const seleccionada = opciones.find((o) => o.valor === valor);

  function elegir(v: string) {
    onChange(v);
    setAbierto(false);
    setBusqueda("");
  }

  return (
    <div className="combobox" ref={ref}>
      <button
        type="button"
        className="combobox-trigger"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        disabled={disabled}
        onClick={() => setAbierto((v) => !v)}
      >
        <span className={seleccionada ? undefined : "combobox-placeholder"}>
          {seleccionada ? seleccionada.nombre : permitirVacio ? etiquetaVacio : placeholder}
        </span>
        <span className="filtro-desplegable-flecha" aria-hidden="true">
          ▾
        </span>
      </button>
      {abierto && (
        <div className="combobox-panel">
          <input
            type="text"
            className="combobox-buscar"
            placeholder={placeholder}
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            autoFocus
          />
          <div className="combobox-lista" role="listbox">
            {permitirVacio && (
              <div
                className={`combobox-opcion${valor === "" ? " seleccionada" : ""}`}
                role="option"
                aria-selected={valor === ""}
                onClick={() => elegir("")}
              >
                {etiquetaVacio}
              </div>
            )}
            {filtradas.map((o) => (
              <div
                key={o.valor}
                className={`combobox-opcion${valor === o.valor ? " seleccionada" : ""}`}
                role="option"
                aria-selected={valor === o.valor}
                onClick={() => elegir(o.valor)}
              >
                {o.nombre}
              </div>
            ))}
            {filtradas.length === 0 && <div className="combobox-vacio">Sin resultados.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
