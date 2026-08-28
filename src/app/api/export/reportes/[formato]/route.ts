import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { leerSesion } from "@/lib/auth/sesion";
import { obtenerTickets } from "@/lib/data/provider";
import { ticketsAWorkbook } from "@/lib/export/excel";
import { DocumentoPdfReportes } from "@/lib/export/pdf/reportes";
import { registrarAuditoria } from "@/lib/logs";
import { porArea, porPersona, porProyecto, porTipoRequerimiento, resumen } from "@/lib/metricas";
import { describirFiltros, filtrosDesdeSearchParams } from "@/lib/reportes-filtros";

// Generar el Excel/PDF de un reporte grande (miles de tickets) puede pasar los
// 10 s por defecto del plan Hobby de Vercel — mismo margen que /api/sync.
export const maxDuration = 300;

/** Fase 2 — exportar el reporte de /reportes con los mismos filtros de la URL. */
export async function GET(req: Request, { params }: { params: Promise<{ formato: string }> }) {
  const { formato } = await params;
  if (formato !== "excel" && formato !== "pdf") {
    return NextResponse.json({ error: "Formato no soportado." }, { status: 400 });
  }

  const sesion = await leerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(req.url);
  const sp = Object.fromEntries(url.searchParams.entries());
  const filtros = filtrosDesdeSearchParams(sp);
  const tickets = await obtenerTickets(sesion, filtros);

  await registrarAuditoria({
    accion: `export_reportes_${formato}`,
    actor: sesion.email,
    detalle: `tickets=${tickets.length} filtros="${describirFiltros(sp)}"`,
  });

  if (formato === "excel") {
    const workbook = ticketsAWorkbook(tickets, "Reportes");
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sitti-reportes-${Date.now()}.xlsx"`,
      },
    });
  }

  const r = resumen(tickets);
  const buffer = await renderToBuffer(
    DocumentoPdfReportes({
      datos: {
        generadoPor: sesion.nombre,
        filtrosTexto: describirFiltros(sp),
        resumen: r,
        areas: porArea(tickets),
        tipos: porTipoRequerimiento(tickets),
        proyectos: porProyecto(tickets),
        personas: porPersona(tickets),
      },
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sitti-reportes-${Date.now()}.pdf"`,
    },
  });
}
