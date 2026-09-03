"use client";

import { useEffect } from "react";

/**
 * Modal genérico controlado. Se cierra con Escape o clic en el overlay —
 * mismo patrón de cierre que ya usa `Topbar` para su menú desplegable.
 */
export function Modal({
  abierto,
  onCerrar,
  titulo,
  children,
  pie,
  ancho,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
  /** Modal más ancho, para formularios largos (perfil, usuario). */
  ancho?: boolean;
}) {
  useEffect(() => {
    if (!abierto) return;
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className={`modal-caja${ancho ? " ancho" : ""}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cabecera">
          <h3>{titulo}</h3>
          <button type="button" className="modal-cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="modal-cuerpo">{children}</div>
        {pie && <div className="modal-pie">{pie}</div>}
      </div>
    </div>
  );
}
