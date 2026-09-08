import { redirect } from "next/navigation";

import { GridTarjetas, KpiStrip, SectionLabel, TarjetaNivel } from "@/components/ui";
import { leerSesion } from "@/lib/auth/sesion";
import { puedeVerPantalla } from "@/lib/auth/tipos";
import { obtenerTickets } from "@/lib/data/provider";
import { numero, porcentaje } from "@/lib/formato";
import { porAplicativo, resumen } from "@/lib/metricas";

export const metadata = { title: "Aplicativos · SITTI" };

/**
 * NIVEL 1 del módulo "Aplicativos": ranking de aplicativos por volumen,
 * mismo patrón que `gerencias/page.tsx`. La lista sale de `APLICATIVOS`
 * (catalogo.ts) — incluye tanto los proyectos JSM operativos como los que
 * solo tienen backlog de desarrollo (Logística, MVI, con `total = 0`
 * porque no tienen tickets que contar, pero sí aparecen en el ranking).
 */
export default async function AplicativosPage() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  // Doble barrera: el enlace solo aparece en el topbar si hay permiso, pero la
  // página también se defiende sola por si alguien escribe la URL a mano.
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

  const tickets = await obtenerTickets(sesion);
  const aplicativos = porAplicativo(tickets);
  const r = resumen(tickets);
  const total = aplicativos.reduce((a, ap) => a + ap.total, 0) || 1;

  const lider = aplicativos[0];

  return (
    <>
      <div className="sh-page-head">
        <div className="eyebrow">
          <span className="dot" /> Nivel 1 · Aplicativos
        </div>
        <h1>Desglose por aplicativo</h1>
        <p>
          Ranking de impacto por volumen de tickets creados en 2026. Entra a un aplicativo para ver
          todo lo hecho en el año y lo que sigue pendiente y activo.
        </p>
      </div>

      <SectionLabel>Panorama</SectionLabel>

      <div className="panorama-grande">
        <KpiStrip
          kpis={[
            { label: "Total de aplicativos", valor: numero(aplicativos.length), color: "#33357E" },
            {
              label: "Aplicativo líder en tickets",
              valor: lider?.nombre ?? "—",
              cap: lider ? `${numero(lider.total)} tickets · ${porcentaje((lider.total / total) * 100)} del total` : undefined,
              color: lider?.color ?? "#3FA9AC",
            },
            { label: "Tickets 2026", valor: numero(r.total), color: "#F7A82C" },
            {
              label: "Tickets en rojo",
              valor: numero(tickets.filter((t) => t.ttrIncumplido || t.ttfrIncumplido).length),
              cap: `${porcentaje(100 - r.cumplimientoTtr)} del TTR fuera de meta`,
              color: "#EC623B",
              alerta: true,
            },
          ]}
        />
      </div>

      <SectionLabel>Ranking de impacto por aplicativo</SectionLabel>

      <div className="ranking-impacto-grande">
        <GridTarjetas n={aplicativos.length}>
          {aplicativos.map((ap, i) => (
            <TarjetaNivel
              key={ap.slug}
              href={`/aplicativos/${ap.slug}`}
              rank={i + 1}
              titulo={ap.nombre}
              total={ap.total}
              proporcion={(ap.total / total) * 100}
              color={ap.color ?? "#33357E"}
              etiqueta={`${porcentaje((ap.total / total) * 100)} del total`}
              pie={`${numero(ap.pendientes)} pendientes · ${porcentaje(ap.cumplimientoTtr)} cumplimiento TTR`}
            />
          ))}
        </GridTarjetas>
      </div>
    </>
  );
}
