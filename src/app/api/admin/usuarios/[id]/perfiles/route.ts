import { NextResponse } from "next/server";
import { z } from "zod";

import { asignarPerfiles, ErrorUsuario } from "@/lib/auth/usuarios-servicio";
import { requiereAdmin } from "@/lib/auth/requiere-admin";
import { registrarAuditoria, registrarError } from "@/lib/logs";

const esquema = z.object({ perfiles: z.array(z.string()) });

/** Enlace "Perfil" de la tabla de usuarios (spec 1.2): reemplaza el conjunto de perfiles asignados. */
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

  const parsed = esquema.safeParse(cuerpo);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  try {
    await asignarPerfiles(id, parsed.data.perfiles);
    await registrarAuditoria({
      accion: "usuario_perfiles_reasignados",
      actor: sesion.email,
      detalle: `id=${id} perfiles=${parsed.data.perfiles.join(",")}`,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ErrorUsuario) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    const crudo = e instanceof Error ? e.message : "Error desconocido";
    await registrarError({ origen: "api", mensaje: "Fallo al reasignar perfiles", detalle: crudo });
    return NextResponse.json({ error: "No se pudieron guardar los perfiles." }, { status: 500 });
  }
}
