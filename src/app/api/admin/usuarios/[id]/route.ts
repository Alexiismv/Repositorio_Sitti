import { NextResponse } from "next/server";

import { requiereAdmin } from "@/lib/auth/requiere-admin";
import { actualizarUsuario, ErrorUsuario, obtenerUsuario } from "@/lib/auth/usuarios-servicio";
import { registrarAuditoria, registrarError } from "@/lib/logs";
import { esquemaUsuario } from "@/lib/validacion/usuario";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resultado = await requiereAdmin("admin-usuarios");
  if (resultado instanceof NextResponse) return resultado;

  const { id } = await params;
  const usuario = await obtenerUsuario(id);
  if (!usuario) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

  return NextResponse.json({ usuario });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resultado = await requiereAdmin("admin-usuarios", "editar");
  if (resultado instanceof NextResponse) return resultado;
  const sesion = resultado;

  const { id } = await params;

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const parsed = esquemaUsuario.safeParse(cuerpo);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  try {
    await actualizarUsuario(id, parsed.data);
    await registrarAuditoria({
      accion: "usuario_editado",
      actor: sesion.email,
      detalle: `id=${id} email=${parsed.data.email}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorUsuario) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    const crudo = e instanceof Error ? e.message : "Error desconocido";
    await registrarError({ origen: "api", mensaje: "Fallo al editar usuario", detalle: crudo });
    return NextResponse.json({ error: "No se pudo guardar el usuario." }, { status: 500 });
  }
}
