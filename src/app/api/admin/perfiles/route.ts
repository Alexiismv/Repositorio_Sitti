import { NextResponse } from "next/server";

import { crearPerfil, ErrorPerfil, listarPerfiles } from "@/lib/auth/perfiles-servicio";
import { requiereAdmin } from "@/lib/auth/requiere-admin";
import { registrarAuditoria, registrarError } from "@/lib/logs";
import { esquemaPerfil } from "@/lib/validacion/perfil";

/**
 * Gestión de perfiles (spec 3.2/3.3). Gate interino por `rol === "administrador"`
 * vía `requiereAdmin()`: el sistema de perfiles todavía no se usa para
 * autorización de sí mismo (eso es Fase 4).
 */

export async function GET() {
  const resultado = await requiereAdmin();
  if (resultado instanceof NextResponse) return resultado;

  const perfiles = await listarPerfiles();
  return NextResponse.json({ perfiles });
}

export async function POST(req: Request) {
  const resultado = await requiereAdmin();
  if (resultado instanceof NextResponse) return resultado;
  const sesion = resultado;

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const parsed = esquemaPerfil.safeParse(cuerpo);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  try {
    const id = await crearPerfil(parsed.data);
    await registrarAuditoria({
      accion: "perfil_creado",
      actor: sesion.email,
      detalle: `nombre=${parsed.data.nombre}`,
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    if (e instanceof ErrorPerfil) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    const crudo = e instanceof Error ? e.message : "Error desconocido";
    await registrarError({ origen: "api", mensaje: "Fallo al crear perfil", detalle: crudo });
    return NextResponse.json({ error: "No se pudo crear el perfil." }, { status: 500 });
  }
}
