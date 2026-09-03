import { redirect } from "next/navigation";

import { GraficaCreadosVsResueltos, GraficaSemanal } from "@/components/charts";
import { MapaSedes } from "@/components/mapa/mapa-sedes";
import { KpiStrip, Ranking, SectionLabel } from "@/components/ui";
import { leerSesion } from "@/lib/auth/sesion";
import { veTodo } from "@/lib/auth/tipos";
import { META_TTFR_HORAS } from "@/lib/catalogo";
import { obtenerTickets } from "@/lib/data/provider";
import { numero, porcentaje } from "@/lib/formato";
import {
  cumplimientoTtrPorPrioridad,
  porGerencia,
  porMes,
  porSede,
  porSemana,
  resumen,
  semaforoDeCumplimiento,
} from "@/lib/metricas";
import { detalleConsolidado, detallePorSede } from "@/lib/sedes-detalle";

export const metadata = { title: "Panel General · SITTI" };

/**
 * Panel General — la pantalla de inicio post-login.
 *
 * Estructura (orden pedido en la sección 5 del doc):
 *   1. Resumen consolidado del año, con el semáforo de cumplimiento.
 *   2. Mapa de sedes con detalle al hover.
 *   3. Tendencia: creados vs. resueltos + comparativo semanal.
 *
 * El ranking de gerencias por volumen (Nivel 1 del flujo) NO vive acá — ya
 * está en /gerencias, y repetirlo en las dos pantallas era redundante.
 */
export default async function PanelGeneral() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  const tickets = await obtenerTickets(sesion);
  const r = resumen(tickets);
  const gerencias = porGerencia(tickets);
  const sedes = porSede(tickets);
  const detallesSede = detallePorSede(tickets);
  const consolidado = detalleConsolidado(tickets, detallesSede.length);
  const alcanceTotal = veTodo(sesion);

  return (
    <>
      <div className="sh-page-head">
        <div className="eyebrow">
          <span className="dot" /> Panel de Gestión
        </div>
        <h1>Panel General de Gestión de Tickets</h1>
        <p>
          {alcanceTotal ? (
            <>
              Vista consolidada 2026 de toda la operación SITTI.
              <br />
              Pasa el mouse sobre una sede del mapa para ver su detalle, o entra a una gerencia
              para bajar al área y al ticket.
            </>
          ) : (
            <>
              Estás viendo únicamente las sedes y áreas que tienes asignadas. Si necesitas acceso a
              otra, pídeselo al Administrador.
            </>
          )}
        </p>
      </div>

      <SectionLabel>Resumen general 2026</SectionLabel>

      <div className="resumen-general">
        <KpiStrip
          kpis={[
            {
              label: "Total tickets 2026",
              valor: numero(r.total),
              cap: `${sedes.length} sedes · ${gerencias.length} gerencias`,
              color: "#33357E",
            },
            {
              label: "Pendientes totales",
              valor: numero(r.pendientes),
              cap: `${numero(r.estancados)} sin movimiento hace 5+ días`,
              capHref: "/reportes?estancado=1",
              color: "#EC623B",
              alerta: r.estancados > 0,
            },
            {
              label: "Tiempo de primera respuesta",
              valor: `${r.ttfrPromedioHoras.toLocaleString("es-CO")}h`,
              cap: `Meta: ${META_TTFR_HORAS}h · toda prioridad`,
              color: r.cumplimientoTtfr >= 90 ? "#3FA9AC" : "#F7A82C",
              alerta: r.cumplimientoTtfr < 80,
            },
            {
              label: "Tiempo final de resolución",
              valor: `${r.ttrPromedioHoras.toLocaleString("es-CO")}h`,
              color: r.cumplimientoTtr >= 90 ? "#3FA9AC" : "#F7A82C",
              alerta: r.cumplimientoTtr < 80,
            },
          ]}
        />
      </div>

      <SectionLabel>Mapa de sedes</SectionLabel>
      <MapaSedes sedes={detallesSede} consolidado={consolidado} />

      <SectionLabel>Tendencia y distribución</SectionLabel>

      <div className="grid-2">
        <div className="panel">
          <h4>Creados vs. resueltos por mes</h4>
          <div className="panel-sub">
            Si la línea de creados se despega de la de resueltos, el backlog está creciendo.
          </div>
          <GraficaCreadosVsResueltos datos={porMes(tickets)} />
        </div>

        <div className="panel">
          <h4>Tickets por sede</h4>
          <div className="panel-sub">Todas las áreas y gerencias visibles para ti</div>
          <Ranking filas={sedes} total={r.total} />
        </div>
      </div>

      <div className="grid-2-igual" style={{ marginTop: 16 }}>
        <div className="panel">
          <h4>Comparativo semana vs. semana</h4>
          <div className="panel-sub">
            Últimas 8 semanas. Cada par de barras es una semana: la primera son los tickets
            creados y la segunda los resueltos. Si la de creados queda por encima varias semanas
            seguidas, el backlog está creciendo. La fecha del eje es el día en que cierra la
            semana.
          </div>
          <GraficaSemanal datos={porSemana(tickets)} />
        </div>

        <div className="panel">
          <h4>Salud del SLA</h4>
          <div className="panel-sub">Promedios sobre los tickets visibles</div>
          <div className="scroll-x">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Indicador</th>
                  <th className="num">Valor</th>
                  <th className="num">%</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>TTFR — primera respuesta</td>
                  <td className="num">{r.ttfrPromedioHoras.toLocaleString("es-CO")} h</td>
                  <td className="num">
                    <span
                      aria-hidden="true"
                      className={`semaforo ${semaforoDeCumplimiento(r.cumplimientoTtfr)}`}
                      style={{ marginRight: 6 }}
                    />
                    {porcentaje(r.cumplimientoTtfr)}
                  </td>
                </tr>
                {cumplimientoTtrPorPrioridad(tickets).map((p) => (
                  <tr key={p.prioridad}>
                    <td>
                      TTR — {p.prioridad} (meta {p.metaHoras}h)
                    </td>
                    <td className="num">{p.promedioHoras.toLocaleString("es-CO")} h</td>
                    <td className="num">
                      <span aria-hidden="true" className={`semaforo ${p.semaforo}`} style={{ marginRight: 6 }} />
                      {porcentaje(p.cumplimiento)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>Resueltos</td>
                  <td className="num">{numero(r.resueltos)}</td>
                  <td className="num">{porcentaje((r.resueltos / (r.total || 1)) * 100)}</td>
                </tr>
                <tr>
                  <td>Cancelados</td>
                  <td className="num">{numero(r.cancelados)}</td>
                  <td className="num">{porcentaje((r.cancelados / (r.total || 1)) * 100)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="nota-demo">
            El semáforo rojo marca lo que ya superó la meta. Las metas son las confirmadas: TTFR 4h
            para todo ticket; TTR según prioridad.
          </p>
        </div>
      </div>
    </>
  );
}
