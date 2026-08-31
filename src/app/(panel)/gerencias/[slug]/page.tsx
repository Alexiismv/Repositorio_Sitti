import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { GraficaComparativa, GraficaCreadosVsResueltos } from "@/components/charts";
import { EstadoVacio, GridTarjetas, KpiStrip, Ranking, SectionLabel, TarjetaNivel } from "@/components/ui";
import { leerSesion } from "@/lib/auth/sesion";
import { gerenciaPorSlug } from "@/lib/catalogo";
import { obtenerTickets } from "@/lib/data/provider";
import { numero, porcentaje } from "@/lib/formato";
import { porArea, porMes, porSede, resumen } from "@/lib/metricas";

/**
 * Renderizado dinámico obligatorio: lo que se muestra depende de la sesión y de
 * los permisos del usuario. Sin esto Next intentaría prerenderizar la ruta y
 * podría servirle a alguien una versión cacheada que no le corresponde.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${gerenciaPorSlug(slug)?.nombre ?? "Gerencia"} · SITTI` };
}

/**
 * NIVEL 2: detalle de una gerencia, desagregado por sus áreas.
 * La pregunta que responde: "dentro de esta gerencia, ¿qué área es la que pesa?".
 */
export default async function DetalleGerencia({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  const gerencia = gerenciaPorSlug(slug);
  if (!gerencia) notFound();

  const tickets = await obtenerTickets(sesion, { gerencias: [slug] });
  const areas = porArea(tickets);
  const r = resumen(tickets);
  const total = r.total || 1;

  return (
    <>
      <div className="sh-breadcrumb">
        <Link href="/">Panel General</Link>
        <span>/</span>
        <Link href="/gerencias">Gerencias</Link>
        <span>/</span>
        <span>{gerencia.nombre}</span>
      </div>

      <div className="sh-page-head">
        <div className="eyebrow">
          <span className="dot" /> Nivel 2 · Detalle de gerencia
        </div>
        <h1>{gerencia.nombre}</h1>
        <p>
          Desagregado por las áreas que agrupa esta gerencia. Entra a un área para ver el estado
          real de sus tickets: qué está pendiente y qué lleva días sin avanzar.
        </p>
      </div>

      {r.total === 0 ? (
        <EstadoVacio
          titulo="Sin tickets visibles en esta gerencia"
          mensaje="O no hay actividad registrada en 2026, o tus permisos no incluyen ninguna de sus áreas. Si crees que debería aparecer algo, pídele acceso al Administrador."
        />
      ) : (
        <>
          <SectionLabel>Resumen de la gerencia</SectionLabel>

          <KpiStrip
            kpis={[
              { label: "Tickets 2026", valor: numero(r.total), cap: `${areas.length} áreas activas`, color: gerencia.color },
              {
                label: "Pendientes",
                valor: numero(r.pendientes),
                cap: `${numero(r.estancados)} estancados 5+ días`,
                color: "#EC623B",
                alerta: r.estancados > 0,
              },
              {
                label: "Cumplimiento TTR",
                valor: porcentaje(r.cumplimientoTtr),
                cap: `TTR promedio ${r.ttrPromedioHoras.toLocaleString("es-CO")} h`,
                color: r.cumplimientoTtr >= 90 ? "#3FA9AC" : "#F7A82C",
                alerta: r.cumplimientoTtr < 80,
              },
              {
                label: "Cumplimiento TTFR",
                valor: porcentaje(r.cumplimientoTtfr),
                cap: `TTFR promedio ${r.ttfrPromedioHoras.toLocaleString("es-CO")} h`,
                color: r.cumplimientoTtfr >= 90 ? "#3FA9AC" : "#F7A82C",
                alerta: r.cumplimientoTtfr < 80,
              },
            ]}
          />

          <SectionLabel>Áreas de la gerencia</SectionLabel>

          <GridTarjetas n={areas.length}>
            {areas.map((a, i) => (
              <TarjetaNivel
                key={a.slug}
                href={`/areas/${a.slug}`}
                rank={i + 1}
                titulo={a.nombre}
                total={a.total}
                proporcion={(a.total / total) * 100}
                color={gerencia.color}
                etiqueta={`${porcentaje((a.total / total) * 100)} de la gerencia`}
                pie={`${numero(a.pendientes)} pendientes · ${numero(a.incumplidos)} en rojo`}
              />
            ))}
          </GridTarjetas>

          <SectionLabel>Tendencia y distribución</SectionLabel>

          <div className="grid-2">
            <div className="panel">
              <h4>Creados vs. resueltos por mes</h4>
              <div className="panel-sub">Solo tickets de {gerencia.nombre}</div>
              <GraficaCreadosVsResueltos datos={porMes(tickets)} />
            </div>

            <div className="panel">
              <h4>Distribución por sede</h4>
              <div className="panel-sub">Dónde se está generando la carga</div>
              <Ranking filas={porSede(tickets)} />
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h4>Peso de cada área</h4>
            <div className="panel-sub">Comparativo directo dentro de la gerencia</div>
            <GraficaComparativa
              datos={areas.map((a) => ({ nombre: a.nombre, total: a.total, color: gerencia.color }))}
              altura={Math.max(160, areas.length * 42)}
            />
          </div>
        </>
      )}
    </>
  );
}
