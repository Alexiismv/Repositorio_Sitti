import { Document, Page } from "@react-pdf/renderer";

import type { FilaAgrupada, Resumen } from "@/lib/metricas";

import { ColumnaTabla, Encabezado, estilos, Kpis, ListaBarras, Pie, SeccionTitulo, TablaPdf } from "./primitivas";

type Persona = FilaAgrupada & { ttrPromedio: number; estancados: number };

export interface DatosPdfPersonas {
  generadoPor: string;
  resumen: Resumen;
  diasEstancadoUmbral: number;
  personas: Persona[];
  promedioCarga: number;
  masCargada?: Persona;
}

const colPersonas: ColumnaTabla<Persona>[] = [
  { header: "Persona", ancho: 2, render: (p) => p.nombre },
  { header: "Tickets", ancho: 1, alinearDerecha: true, render: (p) => `${p.total}` },
  { header: "Pendientes", ancho: 1, alinearDerecha: true, render: (p) => `${p.pendientes}` },
  { header: "Resueltos", ancho: 1, alinearDerecha: true, render: (p) => `${p.resueltos}` },
  { header: "Estancados", ancho: 1, alinearDerecha: true, render: (p) => `${p.estancados}` },
  { header: "TTR prom.", ancho: 1, alinearDerecha: true, render: (p) => `${p.ttrPromedio.toLocaleString("es-CO")} h` },
  { header: "Cumpl. TTR", ancho: 1, alinearDerecha: true, render: (p) => `${Math.round(p.cumplimientoTtr)}%` },
  { header: "En rojo", ancho: 1, alinearDerecha: true, render: (p) => `${p.incumplidos}` },
];

/** Reporte ejecutivo de la pantalla /personas. */
export function DocumentoPdfPersonas({ datos }: { datos: DatosPdfPersonas }) {
  const { generadoPor, resumen: r, diasEstancadoUmbral, personas, promedioCarga, masCargada } = datos;

  const conEstancados = [...personas].sort((a, b) => b.estancados - a.estancados).filter((p) => p.estancados > 0);

  return (
    <Document title="Personas — SITTI">
      <Page size="A4" style={estilos.pagina}>
        <Encabezado
          eyebrow="Personas"
          titulo="Seguimiento por persona"
          subtitulo="Reporte ejecutivo — reparto de carga y tickets estancados"
          generadoPor={generadoPor}
        />

        <Kpis
          items={[
            { label: "Personas con tickets", valor: personas.length.toLocaleString("es-CO"), color: "#242868" },
            { label: "Carga promedio", valor: promedioCarga.toLocaleString("es-CO"), cap: "Tickets 2026 por persona", color: "#2FAFA0" },
            { label: "Persona con más carga", valor: masCargada?.nombre ?? "—", cap: masCargada ? `${masCargada.total} tickets` : undefined, color: "#F6A623" },
            { label: `Estancados (${diasEstancadoUmbral}+ días)`, valor: r.estancados.toLocaleString("es-CO"), color: "#D64545" },
          ]}
        />

        <SeccionTitulo>Tickets estancados por persona (top 10)</SeccionTitulo>
        <ListaBarras
          filas={conEstancados.map((p) => ({ nombre: p.nombre, total: p.estancados, color: "#D64545" }))}
          universo={r.estancados}
        />

        <SeccionTitulo>Carga total (top 10)</SeccionTitulo>
        <ListaBarras filas={personas} universo={r.total} />

        <SeccionTitulo>Detalle completo por persona</SeccionTitulo>
        <TablaPdf columnas={colPersonas} filas={personas} />

        <Pie />
      </Page>
    </Document>
  );
}
