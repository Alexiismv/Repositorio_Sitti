import { NextResponse } from "next/server";

import { cerrarSesion, leerSesion } from "@/lib/auth/sesion";
import { registrarAuditoria } from "@/lib/logs";

export async function POST() {
  const sesion = await leerSesion();
  await cerrarSesion();

  if (sesion) {
    await registrarAuditoria({ accion: "logout", actor: sesion.email });
  }

  return NextResponse.json({ ok: true });
}
