import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { leerSesion } from "@/lib/auth/sesion";
import { puedeUsarAccion } from "@/lib/auth/tipos";
import { DIAS_ESTANCADO_DEFAULT } from "@/lib/catalogo";
import { obtenerTickets } from "@/lib/data/provider";
import { personasAWorkbook } from "@/lib/export/excel";
import { DocumentoPdfPersonas } from "@/lib/export/pdf/personas";
import { registrarAuditoria } from "@/lib/logs";
import { porPersona, resumen } from "@/lib/metricas";

// Mismo margen que /api/sync: generar el archivo puede pasar los 10 s por
// defecto del plan Hobby de Vercel.
export const maxDuration = 300;

/** Fase 2 — exportar el desagregado por persona (/personas). */
export async function GET(req: Request, { params }: { params: Promise<{ formato: string }> }) {
  const { formato } = await params;
  if (formato !== "excel" && formato !== "pdf") {
    return NextResponse.json({ error: "Formato no soportado." }, { status: 400 });
  }

  const sesion = await leerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  if (!puedeUsarAccion(sesion, "personas", "exportar")) {
    return NextResponse.json({ error: "No tienes acceso a esta pestaña." }, { status: 403 });
  }

  const tickets = await obtenerTickets(sesion);
  const personas = porPersona(tickets);
  const r = resumen(tickets);

  await registrarAuditoria({
    accion: `export_personas_${formato}`,
    actor: sesion.email,
    detalle: `personas=${personas.length}`,
  });

  if (formato === "excel") {
    const workbook = personasAWorkbook(personas);
    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="sitti-personas-${Date.now()}.xlsx"`,
      },
    });
  }

  const promedioCarga = personas.length ? Math.round(r.total / personas.length) : 0;

  const buffer = await renderToBuffer(
    DocumentoPdfPersonas({
      datos: {
        generadoPor: sesion.nombre,
        resumen: r,
        diasEstancadoUmbral: DIAS_ESTANCADO_DEFAULT,
        personas,
        promedioCarga,
        masCargada: personas[0],
      },
    }),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="sitti-personas-${Date.now()}.pdf"`,
    },
  });
}
