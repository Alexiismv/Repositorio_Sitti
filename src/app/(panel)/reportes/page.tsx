import { Suspense } from "react";
import { redirect } from "next/navigation";

import { GraficaComparativa } from "@/components/charts";
import { TablaTickets } from "@/components/tabla-tickets";
import { KpiStrip, SectionLabel } from "@/components/ui";
import { leerSesion } from "@/lib/auth/sesion";
import { obtenerTickets } from "@/lib/data/provider";
import { numero, porcentaje } from "@/lib/formato";
import { porArea, porPersona, porProyecto, porTipoRequerimiento, resumen } from "@/lib/metricas";
import { filtrosDesdeSearchParams } from "@/lib/reportes-filtros";

import { BotonesExportar } from "./exportar";
import { FiltrosReporte } from "./filtros";

export const metadata = { title: "Reportes · SITTI" };

type Params = Promise<Record<string, string | string[] | undefined>>;

/**
 * Reportes con filtros dinámicos.
 *
 * Es lo que pidió el negocio para reuniones: armar la vista en el momento,
 * combinando fecha + área + sede + persona + estado, y poder compartir el
 * resultado. Por eso los filtros viven en la URL.
 */
export default async function ReportesPage({ searchParams }: { searchParams: Params }) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  const sp = await searchParams;
  const filtros = filtrosDesdeSearchParams(sp);

  const tickets = await obtenerTickets(sesion, filtros);
  const todos = await obtenerTickets(sesion);
  const r = resumen(tickets);
  const personas = [...new Set(todos.map((t) => t.personaAsignada))].sort();

  const areas = porArea(tickets);
  const tipos = porTipoRequerimiento(tickets);
  const proyectos = porProyecto(tickets);
  const equipos = porPersona(tickets);

  const hayFiltros = Object.keys(sp).length > 0;

  return (
    <>
      <div className="sh-page-head">
        <div className="eyebrow">
          <span className="dot" /> Reportes
        </div>
        <h1>Generador de reportes</h1>
        <p>
          Combina los filtros que necesites y comparte el enlace resultante — la URL guarda la
          selección, así que quien la abra ve exactamente el mismo reporte.
        </p>
      </div>

      <div style={{ marginTop: 22 }}>
        <Suspense fallback={<div className="filtros">Cargando filtros…</div>}>
          <FiltrosReporte personas={personas} />
        </Suspense>
      </div>

      <KpiStrip
        kpis={[
          {
            label: "Tickets en el reporte",
            valor: numero(r.total),
            cap: hayFiltros ? `de ${numero(todos.length)} visibles` : "sin filtros aplicados",
            color: "#33357E",
          },
          {
            label: "Pendientes",
            valor: numero(r.pendientes),
            cap: `${numero(r.estancados)} estancados`,
            color: "#EC623B",
            alerta: r.estancados > 0,
          },
          {
            label: "Cumplimiento TTR",
            valor: porcentaje(r.cumplimientoTtr),
            cap: `Promedio ${r.ttrPromedioHoras.toLocaleString("es-CO")} h`,
            color: r.cumplimientoTtr >= 90 ? "#3FA9AC" : "#F7A82C",
            alerta: r.cumplimientoTtr < 80,
          },
          {
            label: "Cumplimiento TTFR",
            valor: porcentaje(r.cumplimientoTtfr),
            cap: `Promedio ${r.ttfrPromedioHoras.toLocaleString("es-CO")} h`,
            color: r.cumplimientoTtfr >= 90 ? "#3FA9AC" : "#F7A82C",
            alerta: r.cumplimientoTtfr < 80,
          },
        ]}
      />

      {r.total > 0 && (
        <>
          <SectionLabel>Cómo se reparte</SectionLabel>

          <div className="grid-2-igual">
            <div className="panel">
              <h4>Por área</h4>
              <div className="panel-sub">Top 8 dentro de la selección</div>
              <GraficaComparativa
                datos={areas.slice(0, 8).map((a) => ({ nombre: a.nombre, total: a.total, color: a.color }))}
                altura={Math.max(150, Math.min(areas.length, 8) * 38)}
              />
            </div>
            <div className="panel">
              <h4>Por tipo de requerimiento</h4>
              <div className="panel-sub">Qué está pidiendo la ciudadanía y la operación</div>
              <GraficaComparativa
                datos={tipos.slice(0, 8).map((t) => ({ nombre: t.nombre, total: t.total, color: "#3FA9AC" }))}
                altura={Math.max(150, Math.min(tipos.length, 8) * 38)}
              />
            </div>
          </div>

          <div className="grid-2-igual" style={{ marginTop: 16 }}>
            <div className="panel">
              <h4>Por portal de JSM</h4>
              <div className="panel-sub">De cuáles de los 12 proyectos vienen estos tickets</div>
              <GraficaComparativa
                datos={proyectos.map((p) => ({ nombre: p.nombre, total: p.total, color: "#F7A82C" }))}
                altura={Math.max(150, proyectos.length * 38)}
              />
            </div>
            <div className="panel">
              <h4>Por persona asignada</h4>
              <div className="panel-sub">Top 10 por volumen dentro de la selección</div>
              <div className="scroll-x">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th className="num">Tickets</th>
                      <th className="num">Pendientes</th>
                      <th className="num">Cumplimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipos.slice(0, 10).map((p) => (
                      <tr key={p.slug}>
                        <td>{p.nombre}</td>
                        <td className="num">{numero(p.total)}</td>
                        <td className="num">{numero(p.pendientes)}</td>
                        <td className="num" style={{ color: p.cumplimientoTtr < 80 ? "var(--red)" : undefined }}>
                          {porcentaje(p.cumplimientoTtr)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      <SectionLabel>Detalle de tickets</SectionLabel>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <BotonesExportar searchParams={sp} />
        </div>
        <TablaTickets tickets={tickets} limite={60} mostrarArea />
      </div>
    </>
  );
}
