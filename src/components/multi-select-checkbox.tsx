"use client";

import { useEffect, useRef, useState } from "react";

export interface OpcionMultiSelect {
  slug: string;
  nombre: string;
}

/**
 * Desplegable multi-selección con checkboxes. Extraído del patrón ad-hoc que
 * ya validó `reportes/filtros.tsx` (el selector de Área) para reusarlo en
 * Gestión de perfiles (pantallas/acciones/widgets) y en la asignación de
 * perfiles de un usuario.
 */
export function MultiSelectCheckbox({
  label,
  opciones,
  seleccionados,
  onChange,
  placeholderTodos = "Todas",
}: {
  label?: string;
  opciones: OpcionMultiSelect[];
  seleccionados: string[];
  onChange: (slugs: string[]) => void;
  placeholderTodos?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function alClicFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, [abierto]);

  function alternar(slug: string) {
    onChange(seleccionados.includes(slug) ? seleccionados.filter((s) => s !== slug) : [...seleccionados, slug]);
  }

  const resumen =
    seleccionados.length === 0
      ? placeholderTodos
      : seleccionados.length === 1
        ? (opciones.find((o) => o.slug === seleccionados[0])?.nombre ?? seleccionados[0])
        : `${seleccionados.length} seleccionadas`;

  return (
    <div className="filtro-campo filtro-campo-area" ref={ref}>
      {label && <label>{label}</label>}
      <button
        type="button"
        className="filtro-desplegable-trigger"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <span>{resumen}</span>
        <span className="filtro-desplegable-flecha" aria-hidden="true">
          ▾
        </span>
      </button>
      {abierto && (
        <div className="filtro-checklist filtro-checklist-flotante" role="listbox">
          {opciones.map((o) => (
            <label key={o.slug} className="filtro-checklist-item">
              <input type="checkbox" checked={seleccionados.includes(o.slug)} onChange={() => alternar(o.slug)} />
              <span className="filtro-checklist-nombre">{o.nombre}</span>
            </label>
          ))}
          {opciones.length === 0 && <div className="combobox-vacio">Sin opciones.</div>}
        </div>
      )}
    </div>
  );
}
