import { NextResponse } from "next/server";

import {
  actualizarPerfil,
  eliminarPerfil,
  ErrorPerfil,
  obtenerPerfil,
} from "@/lib/auth/perfiles-servicio";
import { requiereAdmin } from "@/lib/auth/requiere-admin";
import { registrarAuditoria, registrarError } from "@/lib/logs";
import { esquemaPerfil } from "@/lib/validacion/perfil";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resultado = await requiereAdmin();
  if (resultado instanceof NextResponse) return resultado;

  const { id } = await params;
  const perfil = await obtenerPerfil(id);
  if (!perfil) return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });

  return NextResponse.json({ perfil });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resultado = await requiereAdmin();
  if (resultado instanceof NextResponse) return resultado;
  const sesion = resultado;

  const { id } = await params;

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
    await actualizarPerfil(id, parsed.data);
    await registrarAuditoria({
      accion: "perfil_editado",
      actor: sesion.email,
      detalle: `id=${id} nombre=${parsed.data.nombre}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorPerfil) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    const crudo = e instanceof Error ? e.message : "Error desconocido";
    await registrarError({ origen: "api", mensaje: "Fallo al editar perfil", detalle: crudo });
    return NextResponse.json({ error: "No se pudo guardar el perfil." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resultado = await requiereAdmin();
  if (resultado instanceof NextResponse) return resultado;
  const sesion = resultado;

  const { id } = await params;

  try {
    await eliminarPerfil(id);
    await registrarAuditoria({ accion: "perfil_eliminado", actor: sesion.email, detalle: `id=${id}` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorPerfil) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    const crudo = e instanceof Error ? e.message : "Error desconocido";
    await registrarError({ origen: "api", mensaje: "Fallo al eliminar perfil", detalle: crudo });
    return NextResponse.json({ error: "No se pudo eliminar el perfil." }, { status: 500 });
  }
}
