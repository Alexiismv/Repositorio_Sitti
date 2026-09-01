import { META_TTR_HORAS } from "@/lib/catalogo";
import type { Ticket } from "@/lib/demo/generador";
import { formatearFecha, horas, numero } from "@/lib/formato";
import { diasAbierto, semaforo } from "@/lib/metricas";

/**
 * Tabla detallada de tickets.
 *
 * Decisiones que importan:
 *  - El estado se muestra con el TEXTO LITERAL de Jira, no con la categoría
 *    normalizada. La categoría sirve para que el tablero se vea consistente
 *    entre los dos vocabularios; el detalle tiene que decir lo que dice Jira,
 *    si no la gente no lo reconoce.
 *  - El semáforo se calcula contra la meta de la prioridad de CADA ticket
 *    (Alta 4h · Media 8h · Baja 24h), no contra un promedio global.
 *  - La tabla vive dentro de un contenedor con scroll propio: en pantallas
 *    angostas se desplaza ella, la página nunca.
 */
export function TablaTickets({
  tickets,
  limite = 50,
  mostrarArea = false,
}: {
  tickets: Ticket[];
  limite?: number;
  mostrarArea?: boolean;
}) {
  const visibles = tickets.slice(0, limite);

  if (!visibles.length) {
    return (
      <p style={{ fontSize: 13, color: "var(--ink-soft)", padding: "18px 0", margin: 0 }}>
        No hay tickets que cumplan estos filtros.
      </p>
    );
  }

  return (
    <>
      <div className="scroll-x">
        <table className="tabla">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Asunto</th>
              {mostrarArea && <th>Área</th>}
              <th>Sede</th>
              <th>Asignado a</th>
              <th>Informador</th>
              <th>Estado</th>
              <th>Prioridad</th>
              <th className="num">TTFR</th>
              <th className="num">TTR</th>
              <th className="num">Días abierto</th>
              <th className="num">Coment.</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((t) => {
              const luz = semaforo(t);
              const cerrado = t.categoriaEstado === "resuelto" || t.categoriaEstado === "cancelado";
              return (
                <tr key={t.clave}>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span
                      className={`semaforo ${luz}`}
                      title={`Meta TTR para prioridad ${t.prioridad}: ${META_TTR_HORAS[t.prioridad]} h`}
                      style={{ marginRight: 7 }}
                    />
                    <span className="mono" style={{ color: "var(--navy)", fontWeight: 600 }}>
                      {t.clave}
                    </span>
                  </td>
                  <td style={{ maxWidth: 300 }}>
                    <div
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 300,
                      }}
                      title={t.tituloTicket}
                    >
                      {t.tituloTicket}
                    </div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-soft)", marginTop: 2 }}>
                      {t.proyecto} · creado {formatearFecha(t.fechaCreacion)}
                    </div>
                  </td>
                  {mostrarArea && <td style={{ whiteSpace: "nowrap" }}>{t.area}</td>}
                  <td style={{ whiteSpace: "nowrap" }}>{t.sede}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{t.personaAsignada}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{t.informador}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <span className="mono" style={{ fontSize: 10.5 }}>
                      {t.estadoTicket}
                    </span>
                  </td>
                  <td>{t.prioridad}</td>
                  <td className="num" style={{ color: t.ttfrIncumplido ? "var(--red)" : undefined }}>
                    {horas(t.ttfrHoras)}
                  </td>
                  <td className="num" style={{ color: t.ttrIncumplido ? "var(--red)" : undefined }}>
                    {horas(t.ttrHoras)}
                  </td>
                  <td
                    className="num"
                    style={{ color: !cerrado && t.diasSinActualizar >= 5 ? "var(--red)" : undefined }}
                  >
                    {cerrado ? "—" : numero(diasAbierto(t))}
                  </td>
                  <td className="num" style={{ fontWeight: t.comentarios >= 12 ? 600 : undefined }}>
                    {numero(t.comentarios)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {tickets.length > visibles.length && (
        <p className="nota-demo">
          Mostrando {numero(visibles.length)} de {numero(tickets.length)} tickets. El Excel exportado
          trae el detalle completo, sin este límite.
        </p>
      )}
    </>
  );
}
