import Link from "next/link";

import { DIAS_ESTANCADO_DEFAULT } from "@/lib/catalogo";
import type { Ticket } from "@/lib/demo/generador";
import { numero } from "@/lib/formato";
import { tableroEstados } from "@/lib/metricas";

/**
 * Tablero Kanban de 4 columnas (Pendiente, En progreso, En espera proveedor,
 * Resueltos/Cancelados), compartido entre el detalle de Área (Nivel 3) y el
 * detalle de Aplicativo. `tableroEstados()` sigue devolviendo las 5 categorías
 * normalizadas del negocio (ver CLAUDE.md §2.1.3) — Resuelto y Cancelado se
 * combinan acá solo a nivel de presentación, no en el modelo de datos.
 */
export function TableroKanban({
  tickets,
  hrefColumna,
}: {
  tickets: Ticket[];
  /** Arma el link "+N más" de cada columna hacia /reportes, con el filtro exacto de esa columna. */
  hrefColumna: (categoria: string) => string;
}) {
  const tablero = tableroEstados(tickets);
  const resueltoCol = tablero.find((c) => c.categoria === "resuelto");
  const canceladoCol = tablero.find((c) => c.categoria === "cancelado");
  const columnas = [
    ...tablero.filter((c) => c.categoria !== "resuelto" && c.categoria !== "cancelado"),
    {
      categoria: "resueltos-cancelados",
      label: "Resueltos/Cancelados",
      color: resueltoCol?.color ?? "#3FA9AC",
      tickets: [...(resueltoCol?.tickets ?? []), ...(canceladoCol?.tickets ?? [])],
    },
  ];

  return (
    <div className="tablero">
      {columnas.map((col) => (
        <div className="tablero-col" key={col.categoria}>
          <div className="tablero-head" data-categoria={col.categoria} style={{ ["--c" as string]: col.color }}>
            <span className="tablero-titulo">{col.label}</span>
            <span className="tablero-conteo mono">{numero(col.tickets.length)}</span>
          </div>
          {col.tickets.slice(0, 6).map((t) => (
            <div className="tablero-card" key={t.clave}>
              <div className="mono tablero-clave">{t.clave}</div>
              <div className="tablero-asunto" title={t.tituloTicket}>
                {t.tituloTicket}
              </div>
              <div className="tablero-pie mono">
                <span>{t.estadoTicket}</span>
                {t.categoriaEstado !== "resuelto" && t.categoriaEstado !== "cancelado" && (
                  <span className={t.diasSinActualizar >= DIAS_ESTANCADO_DEFAULT ? "alerta" : ""}>
                    {t.diasSinActualizar}d sin mover
                  </span>
                )}
              </div>
            </div>
          ))}
          {col.tickets.length > 6 && (
            <Link href={hrefColumna(col.categoria)} className="tablero-mas mono">
              +{numero(col.tickets.length - 6)} más
            </Link>
          )}
          {col.tickets.length === 0 && <div className="tablero-vacio mono">Sin tickets</div>}
        </div>
      ))}
    </div>
  );
}
