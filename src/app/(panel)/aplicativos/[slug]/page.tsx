import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { TableroKanban } from "@/components/tablero-kanban";
import { EstadoVacio, KpiStrip, SectionLabel } from "@/components/ui";
import { leerSesion } from "@/lib/auth/sesion";
import { puedeVerPantalla } from "@/lib/auth/tipos";
import { DIAS_ESTANCADO_DEFAULT, proyectoPorClave } from "@/lib/catalogo";
import { obtenerTickets } from "@/lib/data/provider";
import { numero, porcentaje } from "@/lib/formato";
import { estancados, resumen } from "@/lib/metricas";

/**
 * Renderizado dinámico obligatorio: lo que se muestra depende de la sesión y de
 * los permisos del usuario. Sin esto Next intentaría prerenderizar la ruta y
 * podría servirle a alguien una versión cacheada que no le corresponde.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${proyectoPorClave(slug)?.nombre ?? "Aplicativo"} · SITTI` };
}

/**
 * NIVEL 2 del módulo "Aplicativos": KPIs + tablero Kanban de un aplicativo.
 * Fase 1 = un aplicativo es un proyecto JSM (`proyectoPorClave`, ver la nota
 * en `catalogo.ts` junto a `PROYECTOS` sobre el plan de Fase 2).
 */
export default async function DetalleAplicativo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  if (!puedeVerPantalla(sesion, "aplicativos")) {
    return (
      <div className="sh-page-head">
        <h1>Sin acceso</h1>
        <p>
          Esta pestaña requiere un permiso que no tienes asignado. Pídele acceso a un
          administrador.
        </p>
      </div>
    );
  }

  const aplicativo = proyectoPorClave(slug);
  if (!aplicativo) notFound();

  const tickets = await obtenerTickets(sesion, { proyectos: [aplicativo.clave] });
  const r = resumen(tickets);
  const frenados = estancados(tickets, DIAS_ESTANCADO_DEFAULT);

  const hrefColumna = (categoria: string) =>
    `/reportes?${new URLSearchParams({ proyecto: aplicativo.clave, estado: categoria }).toString()}`;

  return (
    <>
      <div className="sh-breadcrumb">
        <Link href="/">Panel General</Link>
        <span>/</span>
        <Link href="/aplicativos">Aplicativos</Link>
        <span>/</span>
        <span>{aplicativo.nombre}</span>
      </div>

      <div className="sh-page-head">
        <div className="eyebrow">
          <span className="dot" /> Nivel 2 · Detalle de aplicativo
        </div>
        <h1>{aplicativo.nombre}</h1>
        <p>
          Todo lo hecho en el año y lo que sigue pendiente y activo en este aplicativo, en el mismo
          estado exacto en el que está cada ticket en Jira.
        </p>
      </div>

      {r.total === 0 ? (
        <EstadoVacio
          titulo="Sin tickets visibles en este aplicativo"
          mensaje="O no hay actividad registrada en 2026, o tus permisos no incluyen ninguna de las sedes/áreas de este aplicativo."
        />
      ) : (
        <>
          <SectionLabel>Estado del aplicativo</SectionLabel>

          <KpiStrip
            kpis={[
              { label: "Tickets 2026", valor: numero(r.total), color: aplicativo.color },
              {
                label: "Pendientes",
                valor: numero(r.pendientes),
                cap: `${porcentaje((r.pendientes / r.total) * 100)} del aplicativo`,
                color: "#EC623B",
                alerta: r.pendientes > 0,
              },
              {
                label: `Estancados (${DIAS_ESTANCADO_DEFAULT}+ días)`,
                valor: numero(frenados.length),
                cap: "Abiertos sin ninguna actualización",
                color: "#D64545",
                alerta: frenados.length > 0,
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

          <SectionLabel>Tablero por estado</SectionLabel>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "-6px 0 16px", lineHeight: 1.55 }}>
            Las columnas son categorías normalizadas, porque los proyectos de JSM usan dos
            vocabularios distintos de estado. El texto literal de Jira se conserva en cada ticket.
          </p>

          <TableroKanban tickets={tickets} hrefColumna={hrefColumna} />
        </>
      )}
    </>
  );
}
