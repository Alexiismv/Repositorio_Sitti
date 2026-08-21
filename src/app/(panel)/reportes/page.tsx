import { Suspense } from "react";
import { redirect } from "next/navigation";

import { GraficaComparativa } from "@/components/charts";
import { TablaTickets } from "@/components/tabla-tickets";
import { KpiStrip, SectionLabel } from "@/components/ui";
import { leerSesion } from "@/lib/auth/sesion";
import { obtenerTickets, type Filtros } from "@/lib/data/provider";
import { numero, porcentaje } from "@/lib/formato";
import { porArea, porPersona, porProyecto, porTipoRequerimiento, resumen } from "@/lib/metricas";

import { FiltrosReporte } from "./filtros";

export const metadata = { title: "Reportes · SITTI" };

type Params = Promise<Record<string, string | string[] | undefined>>;

const uno = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v || undefined;

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

  const filtros: Filtros = {
    gerencias: uno(sp.gerencia) ? [uno(sp.gerencia)!] : undefined,
    areas: uno(sp.area) ? [uno(sp.area)!] : undefined,
    sedes: uno(sp.sede) ? [uno(sp.sede)!] : undefined,
    personas: uno(sp.persona) ? [uno(sp.persona)!] : undefined,
    tiposRequerimiento: uno(sp.tipo) ? [uno(sp.tipo)!] : undefined,
    estado: (uno(sp.estado) as Filtros["estado"]) ?? "todos",
    // El input date da 'YYYY-MM-DD'; se normaliza a ISO para comparar contra
    // `fecha_creacion`. El 'hasta' incluye el día completo, si no se pierde
    // el último día del rango y nadie entiende por qué faltan tickets.
    desde: uno(sp.desde) ? `${uno(sp.desde)}T00:00:00.000Z` : undefined,
    hasta: uno(sp.hasta) ? `${uno(sp.hasta)}T23:59:59.999Z` : undefined,
    soloIncumplidos: uno(sp.rojo) === "1",
  };

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
            color: "#242868",
          },
          {
            label: "Pendientes",
            valor: numero(r.pendientes),
            cap: `${numero(r.estancados)} estancados`,
            color: "#F1592A",
            alerta: r.estancados > 0,
          },
          {
            label: "Cumplimiento TTR",
            valor: porcentaje(r.cumplimientoTtr),
            cap: `Promedio ${r.ttrPromedioHoras.toLocaleString("es-CO")} h`,
            color: r.cumplimientoTtr >= 90 ? "#2FAFA0" : "#F6A623",
            alerta: r.cumplimientoTtr < 80,
          },
          {
            label: "Cumplimiento TTFR",
            valor: porcentaje(r.cumplimientoTtfr),
            cap: `Promedio ${r.ttfrPromedioHoras.toLocaleString("es-CO")} h`,
            color: r.cumplimientoTtfr >= 90 ? "#2FAFA0" : "#F6A623",
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
                datos={tipos.slice(0, 8).map((t) => ({ nombre: t.nombre, total: t.total, color: "#2FAFA0" }))}
                altura={Math.max(150, Math.min(tipos.length, 8) * 38)}
              />
            </div>
          </div>

          <div className="grid-2-igual" style={{ marginTop: 16 }}>
            <div className="panel">
              <h4>Por portal de JSM</h4>
              <div className="panel-sub">De cuáles de los 12 proyectos vienen estos tickets</div>
              <GraficaComparativa
                datos={proyectos.map((p) => ({ nombre: p.nombre, total: p.total, color: "#F6A623" }))}
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
        <TablaTickets tickets={tickets} limite={60} mostrarArea />
      </div>
    </>
  );
}
