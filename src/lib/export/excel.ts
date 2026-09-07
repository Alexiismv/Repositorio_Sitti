/**
 * Generación de archivos .xlsx para la Fase 2 (exportar reportes).
 *
 * Un solo lugar para las dos formas de exportar que pide el negocio:
 *  - Detalle de tickets (Reportes, Área): una fila por ticket, sin el límite
 *    de 60/40 que tiene la tabla en pantalla.
 *  - Detalle por persona (Personas): una fila por persona, igual a la tabla
 *    que ya se ve en esa pantalla — no hay tickets individuales que listar ahí.
 *
 * Se usa ExcelJS y no el paquete `xlsx` (SheetJS) porque genera el archivo
 * en el servidor sin depender de un DOM ni de APIs de navegador, y permite
 * fijar anchos de columna — sin eso, Excel abre todo apretado en una sola
 * columna angosta y el archivo se ve roto al primer vistazo.
 */

import ExcelJS from "exceljs";

import { gerenciaPorSlug } from "@/lib/catalogo";
import type { Ticket } from "@/lib/demo/generador";
import type { FilaAgrupada } from "@/lib/metricas";

const ESTILO_ENCABEZADO: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: "FFFFFFFF" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF242868" } },
  alignment: { vertical: "middle" },
};

function hojaBase(workbook: ExcelJS.Workbook, nombre: string) {
  const hoja = workbook.addWorksheet(nombre.slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  return hoja;
}

function aplicarEncabezado(hoja: ExcelJS.Worksheet) {
  const fila = hoja.getRow(1);
  fila.eachCell((celda) => {
    celda.style = ESTILO_ENCABEZADO;
  });
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: hoja.columnCount } };
}

/** Detalle de tickets — para Reportes y para el detalle de un Área. */
export function ticketsAWorkbook(tickets: Ticket[], nombreHoja = "Tickets"): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SITTI";
  workbook.created = new Date();

  const hoja = hojaBase(workbook, nombreHoja);
  hoja.columns = [
    { header: "Ticket", key: "clave", width: 12 },
    { header: "Asunto", key: "asunto", width: 44 },
    { header: "Proyecto", key: "proyecto", width: 22 },
    { header: "Gerencia", key: "gerencia", width: 24 },
    { header: "Área", key: "area", width: 26 },
    { header: "Sede", key: "sede", width: 18 },
    { header: "Asignado a", key: "asignado", width: 24 },
    { header: "Informador", key: "informador", width: 24 },
    { header: "Estado (Jira)", key: "estado", width: 20 },
    { header: "Prioridad", key: "prioridad", width: 10 },
    { header: "Tipo de requerimiento", key: "tipo", width: 26 },
    { header: "Fecha creación", key: "creado", width: 14 },
    { header: "Fecha cierre", key: "cerrado", width: 14 },
  ];

  for (const t of tickets) {
    hoja.addRow({
      clave: t.clave,
      asunto: t.tituloTicket,
      proyecto: t.proyecto,
      gerencia: gerenciaPorSlug(t.gerenciaSlug)?.nombre ?? t.gerenciaSlug,
      area: t.area,
      sede: t.sede,
      asignado: t.personaAsignada,
      informador: t.informador,
      estado: t.estadoTicket,
      prioridad: t.prioridad,
      tipo: t.tipoRequerimiento,
      creado: new Date(t.fechaCreacion),
      cerrado: t.fechaCierre ? new Date(t.fechaCierre) : null,
    });
  }

  hoja.getColumn("creado").numFmt = "dd/mm/yyyy";
  hoja.getColumn("cerrado").numFmt = "dd/mm/yyyy";
  aplicarEncabezado(hoja);

  return workbook;
}

/** Detalle por persona — para la pantalla Personas (no tiene tabla de tickets propia). */
export function personasAWorkbook(
  personas: (FilaAgrupada & { ttrPromedio: number; estancados: number })[],
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SITTI";
  workbook.created = new Date();

  const hoja = hojaBase(workbook, "Personas");
  hoja.columns = [
    { header: "Persona", key: "nombre", width: 28 },
    { header: "Tickets", key: "total", width: 10 },
    { header: "Pendientes", key: "pendientes", width: 12 },
    { header: "Resueltos", key: "resueltos", width: 12 },
    { header: "Estancados", key: "estancados", width: 12 },
    { header: "TTR promedio (h)", key: "ttrPromedio", width: 16 },
    { header: "Cumplimiento TTR (%)", key: "cumplimientoTtr", width: 18 },
    { header: "Tickets en rojo", key: "incumplidos", width: 14 },
  ];

  for (const p of personas) {
    hoja.addRow({
      nombre: p.nombre,
      total: p.total,
      pendientes: p.pendientes,
      resueltos: p.resueltos,
      estancados: p.estancados,
      ttrPromedio: Math.round(p.ttrPromedio * 10) / 10,
      cumplimientoTtr: Math.round(p.cumplimientoTtr),
      incumplidos: p.incumplidos,
    });
  }

  aplicarEncabezado(hoja);

  return workbook;
}
