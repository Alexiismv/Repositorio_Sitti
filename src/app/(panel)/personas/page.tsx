import Link from "next/link";
import { redirect } from "next/navigation";

import { GraficaComparativa } from "@/components/charts";
import { ExportarEnlaces, KpiStrip, SectionLabel } from "@/components/ui";
import { leerSesion } from "@/lib/auth/sesion";
import { puedeVerPantalla } from "@/lib/auth/tipos";
import { DIAS_ESTANCADO_DEFAULT } from "@/lib/catalogo";
import { obtenerTickets } from "@/lib/data/provider";
import { numero, porcentaje } from "@/lib/formato";
import { porPersona, resumen } from "@/lib/metricas";

export const metadata = { title: "Personas · SITTI" };

/**
 * Desagregado por persona (assignee).
 *
 * El propósito que declaró el negocio es doble: auditar al equipo Y —sobre
 * todo— "apoyar a desbloquear impedimentos". Por eso la columna que ordena la
 * lectura no es "quién hizo más", sino dónde se está acumulando lo estancado.
 * El texto de la pantalla lo dice explícito para que no se use como ranking
 * de castigo.
 */
export default async function PersonasPage() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  // Doble barrera: el enlace solo aparece en el topbar si hay permiso, pero la
  // página también se defiende sola por si alguien escribe la URL a mano.
  if (!puedeVerPantalla(sesion, "personas")) {
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
  const personas = porPersona(tickets);
  const r = resumen(tickets);

  const conEstancados = [...personas].sort((a, b) => b.estancados - a.estancados);
  const masCargada = personas[0];
  const promedioCarga = personas.length ? Math.round(r.total / personas.length) : 0;

  return (
    <>
      <div className="sh-page-head">
        <div className="eyebrow">
          <span className="dot" /> Personas
        </div>
        <h1>Seguimiento por persona</h1>
        <p>
          Cómo está repartida la carga y dónde hay tickets frenados. La lectura útil no es quién
          tiene más tickets, sino a quién hay que ayudarle a desbloquear.
        </p>
      </div>

      <SectionLabel>Panorama del equipo</SectionLabel>

      <KpiStrip
        kpis={[
          { label: "Personas con tickets", valor: numero(personas.length), color: "#33357E" },
          {
            label: "Carga promedio",
            valor: numero(promedioCarga),
            cap: "Tickets 2026 por persona",
            color: "#3FA9AC",
          },
          {
            label: "Persona con más carga",
            valor: masCargada?.nombre ?? "—",
            cap: masCargada ? `${numero(masCargada.total)} tickets` : undefined,
            color: "#F7A82C",
          },
          {
            label: `Estancados (${DIAS_ESTANCADO_DEFAULT}+ días)`,
            valor: numero(r.estancados),
            cap: "Repartidos en el equipo",
            color: "#D64545",
            alerta: r.estancados > 0,
          },
        ]}
      />

      <SectionLabel>Dónde está lo frenado</SectionLabel>

      <div className="grid-2">
        <div className="panel">
          <h4>Tickets estancados por persona</h4>
          <div className="panel-sub">
            Abiertos sin actualización hace {DIAS_ESTANCADO_DEFAULT} días o más — es la lista para
            la reunión de seguimiento
          </div>
          <GraficaComparativa
            datos={conEstancados
              .filter((p) => p.estancados > 0)
              .slice(0, 10)
              .map((p) => ({ nombre: p.nombre, total: p.estancados, color: "#D64545" }))}
            altura={Math.max(160, Math.min(conEstancados.filter((p) => p.estancados > 0).length, 10) * 38)}
          />
        </div>

        <div className="panel">
          <h4>Carga total</h4>
          <div className="panel-sub">Top 10 por volumen de tickets asignados</div>
          <GraficaComparativa
            datos={personas.slice(0, 10).map((p) => ({ nombre: p.nombre, total: p.total, color: "#33357E" }))}
            altura={Math.max(160, Math.min(personas.length, 10) * 38)}
          />
        </div>
      </div>

      <SectionLabel>Detalle por persona</SectionLabel>

      <div className="panel">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <ExportarEnlaces excelHref="/api/export/personas/excel" pdfHref="/api/export/personas/pdf" />
        </div>
        <div className="scroll-x">
          <table className="tabla">
            <thead>
              <tr>
                <th>Persona</th>
                <th className="num">Tickets</th>
                <th className="num">Pendientes</th>
                <th className="num">Resueltos</th>
                <th className="num">Estancados</th>
                <th className="num">TTR promedio</th>
                <th className="num">Cumplimiento TTR</th>
                <th className="num">En rojo</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.slug}>
                  <td style={{ whiteSpace: "nowrap" }}>{p.nombre}</td>
                  <td className="num">{numero(p.total)}</td>
                  <td className="num">{numero(p.pendientes)}</td>
                  <td className="num">{numero(p.resueltos)}</td>
                  <td className="num" style={{ color: p.estancados ? "var(--red)" : undefined, fontWeight: p.estancados ? 600 : undefined }}>
                    {numero(p.estancados)}
                  </td>
                  <td className="num">{p.ttrPromedio.toLocaleString("es-CO")} h</td>
                  <td className="num" style={{ color: p.cumplimientoTtr < 80 ? "var(--red)" : undefined }}>
                    {porcentaje(p.cumplimientoTtr)}
                  </td>
                  <td className="num">{numero(p.incumplidos)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link
                      href={`/reportes?persona=${encodeURIComponent(p.nombre)}`}
                      style={{ fontSize: 12, fontWeight: 600, color: "var(--navy)", textDecoration: "none" }}
                    >
                      Ver tickets →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
