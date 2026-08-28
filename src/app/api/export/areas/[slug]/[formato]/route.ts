import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { leerSesion } from "@/lib/auth/sesion";
import { areaPorSlug, DIAS_ESTANCADO_DEFAULT, gerenciaPorSlug } from "@/lib/catalogo";
import { obtenerTickets } from "@/lib/data/provider";
import { ticketsAWorkbook } from "@/lib/export/excel";
import { DocumentoPdfArea } from "@/lib/export/pdf/area";
import { registrarAuditoria } from "@/lib/logs";
import { estancados, masComentados, porPersona, porSede, resumen, tableroEstados } from "@/lib/metricas";

// Mismo margen que /api/sync: generar el archivo puede pasar los 10 s por
// defecto del plan Hobby de Vercel.
export const maxDuration = 300;

/** Fase 2 — exportar el detalle de un Área (Nivel 3). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; formato: string }> }) {
  const { slug, formato } = await params;
  if (formato !== "excel" && formato !== "pdf") {
    return NextResponse.json({ error: "Formato no soportado." }, { status: 400 });
  }

  const sesion = await leerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const area = areaPorSlug(slug);
  if (!area) {
    return NextResponse.json({ error: "Área no encontrada." }, { status: 404 });
  }
  const gerencia = gerenciaPorSlug(area.gerencia);

  const tickets = await obtenerTickets(sesion, { areas: [slug] });

  await registrarAuditoria({
    accion: `export_area_${formato}`,
    actor: sesion.email,
    detalle: `area=${slug} tickets=${tickets.length}`,
  });

  if (formato === "excel") {
    const workbook = ticketsAWorkbook(tickets, area.nombre);
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sitti-area-${slug}-${Date.now()}.xlsx"`,
      },
    });
  }

  const r = resumen(tickets);
  const frenados = estancados(tickets, DIAS_ESTANCADO_DEFAULT);
  const tablero = tableroEstados(tickets).map((c) => ({ label: c.label, color: c.color, total: c.tickets.length }));

  const buffer = await renderToBuffer(
    DocumentoPdfArea({
      datos: {
        generadoPor: sesion.nombre,
        areaNombre: area.nombre,
        gerenciaNombre: gerencia?.nombre ?? area.gerencia,
        gerenciaColor: gerencia?.color,
        resumen: r,
        diasEstancadoUmbral: DIAS_ESTANCADO_DEFAULT,
        estancadosCount: frenados.length,
        tablero,
        estancados: frenados,
        complejos: masComentados(tickets, 6),
        sedes: porSede(tickets),
        personas: porPersona(tickets),
      },
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sitti-area-${slug}-${Date.now()}.pdf"`,
    },
  });
}
