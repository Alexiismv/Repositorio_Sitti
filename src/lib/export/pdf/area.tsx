import { Document, Page } from "@react-pdf/renderer";

import type { Ticket } from "@/lib/demo/generador";
import type { FilaAgrupada, Resumen } from "@/lib/metricas";

import { ColumnaTabla, Encabezado, estilos, Kpis, ListaBarras, Pie, SeccionTitulo, TablaPdf } from "./primitivas";

export interface DatosPdfArea {
  generadoPor: string;
  areaNombre: string;
  gerenciaNombre: string;
  gerenciaColor?: string;
  resumen: Resumen;
  diasEstancadoUmbral: number;
  estancadosCount: number;
  tablero: { label: string; color: string; total: number }[];
  estancados: Ticket[];
  complejos: Ticket[];
  sedes: FilaAgrupada[];
  personas: (FilaAgrupada & { ttrPromedio: number; estancados: number })[];
}

const colEstancados: ColumnaTabla<Ticket>[] = [
  { header: "Ticket", ancho: 1, render: (t) => t.clave },
  { header: "Asignado a", ancho: 2, render: (t) => t.personaAsignada },
  { header: "Informador", ancho: 2, render: (t) => t.informador },
  { header: "Sin mover", ancho: 1, alinearDerecha: true, render: (t) => `${t.diasSinActualizar} d` },
];

const colComplejos: ColumnaTabla<Ticket>[] = [
  { header: "Ticket", ancho: 1, render: (t) => t.clave },
  { header: "Estado", ancho: 2, render: (t) => t.estadoTicket },
  { header: "Comentarios", ancho: 1, alinearDerecha: true, render: (t) => `${t.comentarios}` },
];

const colPersonas: ColumnaTabla<DatosPdfArea["personas"][number]>[] = [
  { header: "Persona", ancho: 2, render: (p) => p.nombre },
  { header: "Tickets", ancho: 1, alinearDerecha: true, render: (p) => `${p.total}` },
  { header: "Pendientes", ancho: 1, alinearDerecha: true, render: (p) => `${p.pendientes}` },
  { header: "Estancados", ancho: 1, alinearDerecha: true, render: (p) => `${p.estancados}` },
  { header: "Cumpl. TTR", ancho: 1, alinearDerecha: true, render: (p) => `${Math.round(p.cumplimientoTtr)}%` },
];

/** Reporte ejecutivo del detalle de un Área (Nivel 3). */
export function DocumentoPdfArea({ datos }: { datos: DatosPdfArea }) {
  const { generadoPor, areaNombre, gerenciaNombre, gerenciaColor, resumen: r, diasEstancadoUmbral, estancadosCount, tablero, estancados, complejos, sedes, personas } = datos;

  return (
    <Document title={`Área ${areaNombre} — SITTI`}>
      <Page size="A4" style={estilos.pagina}>
        <Encabezado
          eyebrow="Nivel 3 · Detalle de área"
          titulo={areaNombre}
          subtitulo={`Gerencia: ${gerenciaNombre}`}
          generadoPor={generadoPor}
        />

        <Kpis
          items={[
            { label: "Tickets 2026", valor: r.total.toLocaleString("es-CO"), color: gerenciaColor },
            { label: "Pendientes", valor: r.pendientes.toLocaleString("es-CO"), color: "#EC623B" },
            { label: `Estancados (${diasEstancadoUmbral}+ días)`, valor: estancadosCount.toLocaleString("es-CO"), color: "#D64545" },
            { label: "Cumplimiento TTR", valor: `${Math.round(r.cumplimientoTtr)}%`, color: r.cumplimientoTtr >= 90 ? "#3FA9AC" : "#F7A82C" },
          ]}
        />

        <SeccionTitulo>Tablero por estado</SeccionTitulo>
        <ListaBarras filas={tablero.map((c) => ({ nombre: c.label, total: c.total, color: c.color }))} universo={r.total} limite={5} />

        <SeccionTitulo>Tickets estancados (top 10)</SeccionTitulo>
        <TablaPdf columnas={colEstancados} filas={estancados.slice(0, 10)} />

        <SeccionTitulo>Casos con más comentarios (top 6)</SeccionTitulo>
        <TablaPdf columnas={colComplejos} filas={complejos.slice(0, 6)} />

        <SeccionTitulo>Distribución por sede</SeccionTitulo>
        <ListaBarras filas={sedes} universo={r.total} />

        <SeccionTitulo>Carga por persona</SeccionTitulo>
        <TablaPdf columnas={colPersonas} filas={personas} />

        <Pie />
      </Page>
    </Document>
  );
}
