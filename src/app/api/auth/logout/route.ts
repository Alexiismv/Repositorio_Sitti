import { NextResponse } from "next/server";

import { cerrarSesion, leerSesion, limpiarSesionPendiente } from "@/lib/auth/sesion";
import { registrarAuditoria } from "@/lib/logs";

export async function POST() {
  const sesion = await leerSesion();
  await cerrarSesion();
  // También limpia la cookie de "cambio de contraseña pendiente": si alguien
  // se arrepiente a mitad del flujo obligatorio, "Cerrar sesión" lo saca por
  // completo en vez de dejarlo atrapado entre /login y /cambio-password-obligatorio.
  await limpiarSesionPendiente();

  if (sesion) {
    await registrarAuditoria({ accion: "logout", actor: sesion.email });
  }

  return NextResponse.json({ ok: true });
}
