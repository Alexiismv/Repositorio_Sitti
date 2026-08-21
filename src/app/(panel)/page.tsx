import { redirect } from "next/navigation";

import { GraficaCreadosVsResueltos, GraficaSemanal } from "@/components/charts";
import { MapaSedes } from "@/components/mapa/mapa-sedes";
import { GridTarjetas, KpiStrip, Ranking, SectionLabel, TarjetaNivel } from "@/components/ui";
import { leerSesion } from "@/lib/auth/sesion";
import { veTodo } from "@/lib/auth/tipos";
import { META_TTFR_HORAS } from "@/lib/catalogo";
import { obtenerTickets } from "@/lib/data/provider";
import { numero, porcentaje } from "@/lib/formato";
import { porGerencia, porMes, porSede, porSemana, resumen } from "@/lib/metricas";
import { detalleConsolidado, detallePorSede } from "@/lib/sedes-detalle";

export const metadata = { title: "Panel General · SITTI" };

/**
 * Panel General — la pantalla de inicio post-login.
 *
 * Estructura (orden pedido en la sección 5 del doc):
 *   1. Resumen consolidado del año, con el semáforo de cumplimiento.
 *   2. Mapa de sedes con detalle al hover.
 *   3. Tendencia: creados vs. resueltos + comparativo semanal.
 *   4. Nivel 1 del flujo: ranking de gerencias por volumen.
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

  const totalGerencias = gerencias.reduce((a, g) => a + g.total, 0) || 1;

  return (
    <>
      <div className="sh-page-head">
        <div className="eyebrow">
          <span className="dot" /> Panel de Gestión
        </div>
        <h1>Panel General</h1>
        <p>
          {alcanceTotal ? (
            <>
              Vista consolidada 2026 de toda la operación. Pasa el mouse sobre una sede del mapa
              para ver su detalle, o entra a una gerencia para bajar al área y al ticket.
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

      <KpiStrip
        kpis={[
          {
            label: "Total tickets 2026",
            valor: numero(r.total),
            cap: `${sedes.length} sedes · ${gerencias.length} gerencias`,
            color: "#242868",
          },
          {
            label: "Pendientes",
            valor: numero(r.pendientes),
            cap: `${numero(r.estancados)} sin movimiento hace 5+ días`,
            color: "#F1592A",
            alerta: r.estancados > 0,
          },
          {
            label: `Cumplimiento TTFR (${META_TTFR_HORAS}h)`,
            valor: porcentaje(r.cumplimientoTtfr),
            cap: "Meta: responder en 4h, toda prioridad",
            color: r.cumplimientoTtfr >= 90 ? "#2FAFA0" : "#F6A623",
            alerta: r.cumplimientoTtfr < 80,
          },
          {
            label: "Cumplimiento TTR",
            valor: porcentaje(r.cumplimientoTtr),
            cap: "Meta por prioridad · Alta 4h · Media 8h · Baja 24h",
            color: r.cumplimientoTtr >= 90 ? "#2FAFA0" : "#F6A623",
            alerta: r.cumplimientoTtr < 80,
          },
        ]}
      />

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
          <Ranking filas={sedes} />
        </div>
      </div>

      <div className="grid-2-igual" style={{ marginTop: 16 }}>
        <div className="panel">
          <h4>Comparativo semana vs. semana</h4>
          <div className="panel-sub">Últimas 8 semanas · S-0 es la semana en curso</div>
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
                  <th className="num">Promedio</th>
                  <th className="num">Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>TTFR — primera respuesta</td>
                  <td className="num">{r.ttfrPromedioHoras.toLocaleString("es-CO")} h</td>
                  <td className="num" style={{ color: r.cumplimientoTtfr < 80 ? "var(--red)" : undefined }}>
                    {porcentaje(r.cumplimientoTtfr)}
                  </td>
                </tr>
                <tr>
                  <td>TTR — resolución</td>
                  <td className="num">{r.ttrPromedioHoras.toLocaleString("es-CO")} h</td>
                  <td className="num" style={{ color: r.cumplimientoTtr < 80 ? "var(--red)" : undefined }}>
                    {porcentaje(r.cumplimientoTtr)}
                  </td>
                </tr>
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

      <SectionLabel>Ranking de impacto por gerencia</SectionLabel>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "-6px 0 18px", lineHeight: 1.55 }}>
        Ordenadas por volumen de tickets creados — es el orden en que conviene poner la atención
        gerencial. Entra a una para ver qué área está pesando dentro.
      </p>

      <GridTarjetas n={gerencias.length}>
        {gerencias.map((g, i) => (
          <TarjetaNivel
            key={g.slug}
            href={`/gerencias/${g.slug}`}
            rank={i + 1}
            titulo={g.nombre}
            total={g.total}
            proporcion={(g.total / totalGerencias) * 100}
            color={g.color ?? "#242868"}
            etiqueta={g.pendientes ? `${numero(g.pendientes)} pendientes` : undefined}
            pie={`${porcentaje(g.cumplimientoTtr)} cumplimiento TTR · ${numero(g.incumplidos)} en rojo`}
          />
        ))}
      </GridTarjetas>
    </>
  );
}
