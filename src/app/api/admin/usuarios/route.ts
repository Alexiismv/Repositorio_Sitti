import { NextResponse } from "next/server";

import { requiereAdmin } from "@/lib/auth/requiere-admin";
import {
  crearUsuario,
  ErrorUsuario,
  listarUsuarios,
  type CampoOrden,
} from "@/lib/auth/usuarios-servicio";
import { registrarAuditoria, registrarError } from "@/lib/logs";
import { esquemaUsuario } from "@/lib/validacion/usuario";

const CAMPOS_ORDEN: CampoOrden[] = ["nombre", "email", "cargo"];

export async function GET(req: Request) {
  const resultado = await requiereAdmin("admin-usuarios");
  if (resultado instanceof NextResponse) return resultado;

  const url = new URL(req.url);
  const p = url.searchParams;

  const ordenPor = p.get("orden");
  const activo = p.get("activo");

  const datos = await listarUsuarios({
    texto: p.get("q") ?? undefined,
    activo: activo === "si" ? true : activo === "no" ? false : undefined,
    perfilId: p.get("perfil") ?? undefined,
    sedeSlug: p.get("sede") ?? undefined,
    ordenPor: CAMPOS_ORDEN.includes(ordenPor as CampoOrden) ? (ordenPor as CampoOrden) : "nombre",
    ordenDir: p.get("dir") === "desc" ? "desc" : "asc",
    pagina: Number(p.get("pagina")) || 1,
    tamanoPagina: Number(p.get("porPagina")) || 10,
  });

  return NextResponse.json(datos);
}

export async function POST(req: Request) {
  const resultado = await requiereAdmin("admin-usuarios", "crear");
  if (resultado instanceof NextResponse) return resultado;
  const sesion = resultado;

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
    const id = await crearUsuario(parsed.data);
    await registrarAuditoria({
      accion: "usuario_creado",
      actor: sesion.email,
      detalle: `email=${parsed.data.email}`,
    });
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e) {
    if (e instanceof ErrorUsuario) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    const crudo = e instanceof Error ? e.message : "Error desconocido";
    await registrarError({ origen: "api", mensaje: "Fallo al crear usuario", detalle: crudo });
    return NextResponse.json({ error: "No se pudo crear el usuario." }, { status: 500 });
  }
}
