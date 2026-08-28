import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { GraficaCreadosVsResueltos } from "@/components/charts";
import { TablaTickets } from "@/components/tabla-tickets";
import { EstadoVacio, ExportarEnlaces, KpiStrip, Ranking, SectionLabel } from "@/components/ui";
import { leerSesion } from "@/lib/auth/sesion";
import { DIAS_ESTANCADO_DEFAULT, areaPorSlug, gerenciaPorSlug } from "@/lib/catalogo";
import { obtenerTickets } from "@/lib/data/provider";
import { numero, porcentaje } from "@/lib/formato";
import {
  estancados,
  masComentados,
  modaDe,
  porMes,
  porPersona,
  porSede,
  resumen,
  tableroEstados,
} from "@/lib/metricas";

/**
 * Renderizado dinámico obligatorio: lo que se muestra depende de la sesión y de
 * los permisos del usuario. Sin esto Next intentaría prerenderizar la ruta y
 * podría servirle a alguien una versión cacheada que no le corresponde.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `${areaPorSlug(slug)?.nombre ?? "Área"} · SITTI` };
}

/**
 * NIVEL 3: vista operativa de un área.
 *
 * Es la pantalla donde un coordinador actúa, no donde contempla. Por eso el
 * orden es: qué está frenado (estancados) -> tablero por estado -> tabla completa.
 * Los tickets con muchos comentarios van arriba porque son el proxy de "caso
 * escalado que necesita que alguien de gerencia se meta".
 */
export default async function DetalleArea({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  const area = areaPorSlug(slug);
  if (!area) notFound();

  const gerencia = gerenciaPorSlug(area.gerencia);
  const tickets = await obtenerTickets(sesion, { areas: [slug] });
  const r = resumen(tickets);
  const tablero = tableroEstados(tickets);
  const frenados = estancados(tickets, DIAS_ESTANCADO_DEFAULT);
  const complejos = masComentados(tickets, 6);
  const personas = porPersona(tickets);

  return (
    <>
      <div className="sh-breadcrumb">
        <Link href="/">Panel General</Link>
        <span>/</span>
        <Link href="/gerencias">Gerencias</Link>
        <span>/</span>
        <Link href={`/gerencias/${area.gerencia}`}>{gerencia?.nombre}</Link>
        <span>/</span>
        <span>{area.nombre}</span>
      </div>

      <div className="sh-page-head">
        <div className="eyebrow">
          <span className="dot" /> Nivel 3 · Detalle de área
        </div>
        <h1>{area.nombre}</h1>
        <p>
          Estado real de la operación del área: qué está pendiente, qué lleva días sin movimiento y
          en qué estado exacto de Jira está cada ticket.
        </p>
      </div>

      {r.total === 0 ? (
        <EstadoVacio
          titulo="Sin tickets visibles en esta área"
          mensaje="No hay actividad registrada, o tus permisos no incluyen esta área en ninguna sede."
        />
      ) : (
        <>
          <SectionLabel>Estado del área</SectionLabel>

          <KpiStrip
            kpis={[
              { label: "Tickets 2026", valor: numero(r.total), cap: `Gerencia: ${gerencia?.nombre}`, color: gerencia?.color },
              {
                label: "Pendientes",
                valor: numero(r.pendientes),
                cap: `${porcentaje((r.pendientes / r.total) * 100)} del área`,
                color: "#F1592A",
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
                cap: `Tipo más solicitado: ${modaDe(tickets, (t) => t.tipoRequerimiento)}`,
                color: r.cumplimientoTtr >= 90 ? "#2FAFA0" : "#F6A623",
                alerta: r.cumplimientoTtr < 80,
              },
            ]}
          />

          <SectionLabel>Tablero por estado</SectionLabel>
          <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "-6px 0 16px", lineHeight: 1.55 }}>
            Las columnas son categorías normalizadas, porque los proyectos de JSM usan dos
            vocabularios distintos de estado. El texto literal de Jira se conserva en cada ticket.
          </p>

          <div className="tablero">
            {tablero.map((col) => (
              <div className="tablero-col" key={col.categoria}>
                <div className="tablero-head" style={{ ["--c" as string]: col.color }}>
                  <span className="tablero-titulo">{col.label}</span>
                  <span className="tablero-conteo mono">{numero(col.tickets.length)}</span>
                </div>
                {col.tickets.slice(0, 6).map((t) => (
                  <div className="tablero-card" key={t.clave}>
                    <div className="mono tablero-clave">{t.clave}</div>
                    <div className="tablero-asunto" title={t.tituloTicket}>
                      {t.tituloTicket}
                    </div>
                    <div className="tablero-pie mono">
                      <span>{t.estadoTicket}</span>
                      {t.categoriaEstado !== "resuelto" && t.categoriaEstado !== "cancelado" && (
                        <span className={t.diasSinActualizar >= DIAS_ESTANCADO_DEFAULT ? "alerta" : ""}>
                          {t.diasSinActualizar}d sin mover
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {col.tickets.length > 6 && (
                  <div className="tablero-mas mono">+{numero(col.tickets.length - 6)} más</div>
                )}
                {col.tickets.length === 0 && <div className="tablero-vacio mono">Sin tickets</div>}
              </div>
            ))}
          </div>

          <SectionLabel>Lo que necesita atención</SectionLabel>

          <div className="grid-2-igual">
            <div className="panel">
              <h4>Tickets estancados</h4>
              <div className="panel-sub">
                Abiertos sin actualización hace {DIAS_ESTANCADO_DEFAULT} días o más
              </div>
              {frenados.length ? (
                <div className="scroll-x">
                  <table className="tabla">
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Asignado a</th>
                        <th className="num">Sin mover</th>
                      </tr>
                    </thead>
                    <tbody>
                      {frenados.slice(0, 8).map((t) => (
                        <tr key={t.clave}>
                          <td className="mono" style={{ color: "var(--navy)", fontWeight: 600 }}>
                            {t.clave}
                          </td>
                          <td>{t.personaAsignada}</td>
                          <td className="num" style={{ color: "var(--red)", fontWeight: 600 }}>
                            {t.diasSinActualizar} d
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                  Nada frenado en esta área. 👌
                </p>
              )}
            </div>

            <div className="panel">
              <h4>Casos con más comentarios</h4>
              <div className="panel-sub">
                Hilos largos = casos complejos o escalados que suelen necesitar apoyo de gerencia
              </div>
              <div className="scroll-x">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Estado</th>
                      <th className="num">Comentarios</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complejos.map((t) => (
                      <tr key={t.clave}>
                        <td className="mono" style={{ color: "var(--navy)", fontWeight: 600 }}>
                          {t.clave}
                        </td>
                        <td className="mono" style={{ fontSize: 10.5 }}>
                          {t.estadoTicket}
                        </td>
                        <td className="num" style={{ fontWeight: t.comentarios >= 12 ? 600 : undefined }}>
                          {numero(t.comentarios)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid-2" style={{ marginTop: 16 }}>
            <div className="panel">
              <h4>Creados vs. resueltos</h4>
              <div className="panel-sub">Evolución mensual del área</div>
              <GraficaCreadosVsResueltos datos={porMes(tickets)} />
            </div>
            <div className="panel">
              <h4>Distribución por sede</h4>
              <div className="panel-sub">Dónde se origina la carga del área</div>
              <Ranking filas={porSede(tickets)} />
            </div>
          </div>

          <SectionLabel>Carga por persona</SectionLabel>

          <div className="panel">
            <h4>Equipo del área</h4>
            <div className="panel-sub">
              Para apoyar a desbloquear, no para castigar: el dato útil es dónde se está acumulando
              lo estancado
            </div>
            <div className="scroll-x">
              <table className="tabla">
                <thead>
                  <tr>
                    <th>Persona</th>
                    <th className="num">Tickets</th>
                    <th className="num">Pendientes</th>
                    <th className="num">Estancados</th>
                    <th className="num">TTR promedio</th>
                    <th className="num">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody>
                  {personas.map((p) => (
                    <tr key={p.slug}>
                      <td>{p.nombre}</td>
                      <td className="num">{numero(p.total)}</td>
                      <td className="num">{numero(p.pendientes)}</td>
                      <td className="num" style={{ color: p.estancados ? "var(--red)" : undefined }}>
                        {numero(p.estancados)}
                      </td>
                      <td className="num">{p.ttrPromedio.toLocaleString("es-CO")} h</td>
                      <td className="num" style={{ color: p.cumplimientoTtr < 80 ? "var(--red)" : undefined }}>
                        {porcentaje(p.cumplimientoTtr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <SectionLabel>Todos los tickets del área</SectionLabel>

          <div className="panel">
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
              <ExportarEnlaces
                excelHref={`/api/export/areas/${slug}/excel`}
                pdfHref={`/api/export/areas/${slug}/pdf`}
              />
            </div>
            <TablaTickets tickets={tickets} limite={40} />
          </div>
        </>
      )}
    </>
  );
}
