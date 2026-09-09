"use client";

import { useState } from "react";
import Link from "next/link";

import { DIAS_ESTANCADO_DEFAULT } from "@/lib/catalogo";
import type { ColumnaTablero } from "@/lib/metricas";
import { numero } from "@/lib/formato";

const VISIBLES = 6;

/**
 * Tablero Kanban genérico — quien llama arma las columnas
 * (`columnasOperacion()`/`columnasBacklog()` en `metricas.ts`), así que este
 * componente no sabe si está mostrando tickets operativos o ítems de backlog
 * de desarrollo. Se usa dos veces por aplicativo/área: el tablero de backlog
 * (6 columnas) y el operativo (4 columnas).
 */
export function TableroKanban({
  columnas,
  filtroReportes,
}: {
  columnas: ColumnaTablero[];
  /**
   * Filtros base de /reportes (gerencia+área, o proyecto) a los que se les
   * suma `estado=<categoría>` para armar el link "+N más" de cada columna.
   *
   * Son datos y no una función a propósito: este componente es cliente (el
   * "+N más" del backlog despliega la columna en el sitio), y React no puede
   * serializar una función que cruza del servidor al cliente.
   *
   * Si se omite, el "+N más" despliega el resto de tarjetas dentro de la
   * misma columna — caso del tablero de backlog, que /reportes no sabe
   * consultar porque sus ítems no son tickets de operación.
   */
  filtroReportes?: Record<string, string>;
}) {
  const [expandidas, setExpandidas] = useState<string[]>([]);

  const hrefColumna = (categoria: string) =>
    `/reportes?${new URLSearchParams({ ...filtroReportes, estado: categoria }).toString()}`;

  const alternar = (categoria: string) =>
    setExpandidas((previas) =>
      previas.includes(categoria)
        ? previas.filter((c) => c !== categoria)
        : [...previas, categoria],
    );

  return (
    <div className="tablero" style={{ gridTemplateColumns: `repeat(${columnas.length}, minmax(0, 1fr))` }}>
      {columnas.map((col) => {
        const expandida = expandidas.includes(col.categoria);
        const visibles = expandida ? col.tickets : col.tickets.slice(0, VISIBLES);
        const ocultos = col.tickets.length - VISIBLES;

        return (
          <div className="tablero-col" key={col.categoria}>
            <div className="tablero-head" data-categoria={col.categoria} style={{ ["--c" as string]: col.color }}>
              <span className="tablero-titulo">{col.label}</span>
              <span className="tablero-conteo mono">{numero(col.tickets.length)}</span>
            </div>
            {visibles.map((t) => (
              <div className="tablero-card" key={t.clave}>
                <div className="mono tablero-clave">{t.clave}</div>
                <div className="tablero-asunto" title={t.tituloTicket}>
                  {t.tituloTicket}
                </div>
                <div className="tablero-pie mono">
                  <span>{t.estadoTicket}</span>
                  {!t.terminal && (
                    <span className={t.diasSinActualizar >= DIAS_ESTANCADO_DEFAULT ? "alerta" : ""}>
                      {t.diasSinActualizar}d sin mover
                    </span>
                  )}
                </div>
              </div>
            ))}
            {ocultos > 0 &&
              (filtroReportes ? (
                <Link href={hrefColumna(col.categoria)} className="tablero-mas mono">
                  +{numero(ocultos)} más
                </Link>
              ) : (
                <button type="button" className="tablero-mas mono" onClick={() => alternar(col.categoria)}>
                  {expandida ? "Ver menos" : `+${numero(ocultos)} más`}
                </button>
              ))}
            {col.tickets.length === 0 && <div className="tablero-vacio mono">Sin tickets</div>}
          </div>
        );
      })}
    </div>
  );
}
