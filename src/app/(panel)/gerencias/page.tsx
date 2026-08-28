import { redirect } from "next/navigation";

import { GraficaComparativa } from "@/components/charts";
import { GridTarjetas, KpiStrip, SectionLabel, TarjetaNivel } from "@/components/ui";
import { leerSesion } from "@/lib/auth/sesion";
import { obtenerTickets } from "@/lib/data/provider";
import { numero, porcentaje } from "@/lib/formato";
import { porArea, porGerencia, resumen } from "@/lib/metricas";

export const metadata = { title: "Gerencias · SITTI" };

/**
 * NIVEL 1 del flujo de navegación: las gerencias ordenadas por volumen.
 *
 * El objetivo declarado es "identificar de un vistazo cuáles impactan más
 * operativamente", así que el orden es por volumen de creados y no alfabético.
 */
export default async function GerenciasPage() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  const tickets = await obtenerTickets(sesion);
  const gerencias = porGerencia(tickets);
  const areas = porArea(tickets);
  const r = resumen(tickets);
  const total = gerencias.reduce((a, g) => a + g.total, 0) || 1;

  const lider = gerencias[0];

  return (
    <>
      <div className="sh-page-head">
        <div className="eyebrow">
          <span className="dot" /> Nivel 1 · Gerencias
        </div>
        <h1>Desglose por gerencia</h1>
        <p>
          Ranking de impacto por volumen de tickets creados en 2026. Entra a una gerencia para ver
          qué área específica pesa dentro de ella, y de ahí al detalle operativo de los tickets.
        </p>
      </div>

      <SectionLabel>Panorama</SectionLabel>

      <div className="panorama-grande">
        <KpiStrip
          kpis={[
            { label: "Gerencias visibles", valor: numero(gerencias.length), color: "#242868" },
            {
              label: "Gerencia líder",
              valor: lider?.nombre ?? "—",
              cap: lider ? `${numero(lider.total)} tickets · ${porcentaje((lider.total / total) * 100)} del total` : undefined,
              color: lider?.color ?? "#2FAFA0",
            },
            { label: "Áreas con actividad", valor: numero(areas.length), color: "#F6A623" },
            {
              label: "Tickets en rojo",
              valor: numero(tickets.filter((t) => t.ttrIncumplido || t.ttfrIncumplido).length),
              cap: `${porcentaje(100 - r.cumplimientoTtr)} del TTR fuera de meta`,
              color: "#F1592A",
              alerta: true,
            },
          ]}
        />
      </div>

      <SectionLabel>Ranking de impacto por gerencia</SectionLabel>

      <div className="ranking-impacto-grande">
        <GridTarjetas n={gerencias.length}>
          {gerencias.map((g, i) => (
            <TarjetaNivel
              key={g.slug}
              href={`/gerencias/${g.slug}`}
              rank={i + 1}
              titulo={g.nombre}
              total={g.total}
              proporcion={(g.total / total) * 100}
              color={g.color ?? "#242868"}
              etiqueta={`${porcentaje((g.total / total) * 100)} del total`}
              pie={`${numero(g.pendientes)} pendientes · ${porcentaje(g.cumplimientoTtr)} cumplimiento TTR`}
            />
          ))}
        </GridTarjetas>
      </div>

      <SectionLabel>Comparativo entre áreas</SectionLabel>

      <div className="panel">
        <h4>Volumen 2026 por área</h4>
        <div className="panel-sub">
          Las 10 áreas de mayor volumen, coloreadas por la gerencia a la que pertenecen
        </div>
        <GraficaComparativa
          datos={areas.slice(0, 10).map((a) => ({ nombre: a.nombre, total: a.total, color: a.color }))}
          altura={360}
        />
      </div>
    </>
  );
}
