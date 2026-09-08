import Link from "next/link";

import { DIAS_ESTANCADO_DEFAULT } from "@/lib/catalogo";
import type { ColumnaTablero } from "@/lib/metricas";
import { numero } from "@/lib/formato";

/**
 * Tablero Kanban genérico — puramente presentacional. Quien llama arma las
 * columnas (`columnasOperacion()`/`columnasBacklog()` en `metricas.ts`), así
 * que este componente no sabe si está mostrando tickets operativos o ítems
 * de backlog de desarrollo. Se usa dos veces por aplicativo/área: el tablero
 * de backlog (6 columnas) y el operativo (4 columnas).
 */
export function TableroKanban({
  columnas,
  hrefColumna,
}: {
  columnas: ColumnaTablero[];
  /**
   * Arma el link "+N más" de cada columna hacia /reportes. Si se omite, el
   * "+N más" se muestra como texto plano — caso del tablero de backlog, que
   * /reportes todavía no sabe filtrar (ver Fase 2 en catalogo.ts).
   */
  hrefColumna?: (categoria: string) => string;
}) {
  return (
    <div className="tablero" style={{ gridTemplateColumns: `repeat(${columnas.length}, minmax(0, 1fr))` }}>
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
                {!t.terminal && (
                  <span className={t.diasSinActualizar >= DIAS_ESTANCADO_DEFAULT ? "alerta" : ""}>
                    {t.diasSinActualizar}d sin mover
                  </span>
                )}
              </div>
            </div>
          ))}
          {col.tickets.length > 6 &&
            (hrefColumna ? (
              <Link href={hrefColumna(col.categoria)} className="tablero-mas mono">
                +{numero(col.tickets.length - 6)} más
              </Link>
            ) : (
              <div className="tablero-mas mono">+{numero(col.tickets.length - 6)} más</div>
            ))}
          {col.tickets.length === 0 && <div className="tablero-vacio mono">Sin tickets</div>}
        </div>
      ))}
    </div>
  );
}
