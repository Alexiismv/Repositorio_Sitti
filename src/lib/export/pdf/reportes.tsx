import { Document, Page } from "@react-pdf/renderer";

import type { Resumen, FilaAgrupada } from "@/lib/metricas";

import { Encabezado, estilos, Kpis, ListaBarras, Pie, SeccionTitulo } from "./primitivas";

export interface DatosPdfReportes {
  generadoPor: string;
  filtrosTexto: string;
  resumen: Resumen;
  areas: FilaAgrupada[];
  tipos: FilaAgrupada[];
  proyectos: FilaAgrupada[];
  personas: FilaAgrupada[];
}

/** Reporte ejecutivo de la pantalla /reportes — respeta los mismos filtros que la URL. */
export function DocumentoPdfReportes({ datos }: { datos: DatosPdfReportes }) {
  const { generadoPor, filtrosTexto, resumen: r, areas, tipos, proyectos, personas } = datos;

  return (
    <Document title="Reporte SITTI">
      <Page size="A4" style={estilos.pagina}>
        <Encabezado
          eyebrow="Reportes"
          titulo="Reporte ejecutivo"
          subtitulo={filtrosTexto}
          generadoPor={generadoPor}
        />

        <Kpis
          items={[
            { label: "Tickets en el reporte", valor: r.total.toLocaleString("es-CO"), color: "#242868" },
            { label: "Pendientes", valor: r.pendientes.toLocaleString("es-CO"), cap: `${r.estancados} estancados`, color: "#F1592A" },
            {
              label: "Cumplimiento TTR",
              valor: `${Math.round(r.cumplimientoTtr)}%`,
              cap: `Promedio ${r.ttrPromedioHoras.toLocaleString("es-CO")} h`,
              color: r.cumplimientoTtr >= 90 ? "#2FAFA0" : "#F6A623",
            },
            {
              label: "Cumplimiento TTFR",
              valor: `${Math.round(r.cumplimientoTtfr)}%`,
              cap: `Promedio ${r.ttfrPromedioHoras.toLocaleString("es-CO")} h`,
              color: r.cumplimientoTtfr >= 90 ? "#2FAFA0" : "#F6A623",
            },
          ]}
        />

        <SeccionTitulo>Por área (top 10)</SeccionTitulo>
        <ListaBarras filas={areas} universo={r.total} />

        <SeccionTitulo>Por tipo de requerimiento (top 10)</SeccionTitulo>
        <ListaBarras filas={tipos} universo={r.total} />

        <SeccionTitulo>Por portal de JSM</SeccionTitulo>
        <ListaBarras filas={proyectos} universo={r.total} limite={12} />

        <SeccionTitulo>Por persona asignada (top 10)</SeccionTitulo>
        <ListaBarras filas={personas} universo={r.total} />

        <Pie />
      </Page>
    </Document>
  );
}
