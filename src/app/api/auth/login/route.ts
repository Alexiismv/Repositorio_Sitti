import { NextResponse } from "next/server";
import { z } from "zod";

import { crearSesion } from "@/lib/auth/sesion";
import { buscarUsuarioDemo } from "@/lib/auth/usuarios-demo";
import { DEMO_MODE } from "@/lib/data/provider";
import { registrarAuditoria } from "@/lib/logs";

const esquema = z.object({
  usuario: z.string().min(1).max(120),
  password: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const parsed = esquema.safeParse(cuerpo);
  if (!parsed.success) {
    return NextResponse.json({ error: "Usuario y contraseña son obligatorios." }, { status: 400 });
  }

  const { usuario, password } = parsed.data;

  if (!DEMO_MODE) {
    // Con base real: SELECT ... FROM auth.usuarios WHERE email = $1 AND activo
    // y comparar con bcrypt.compare(password, password_hash).
    // Ver docs/SETUP-ALEXIS.md § Conectar la base de datos.
    return NextResponse.json(
      { error: "La autenticación contra Postgres todavía no está implementada." },
      { status: 501 },
    );
  }

  const encontrado = buscarUsuarioDemo(usuario, password);

  if (!encontrado) {
    await registrarAuditoria({
      accion: "login_fallido",
      actor: usuario,
      detalle: "Credenciales inválidas",
    });
    // Mensaje deliberadamente genérico: no revelamos si el usuario existe.
    return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
  }

  await crearSesion({
    sub: encontrado.id,
    email: encontrado.email,
    nombre: encontrado.nombre,
    rol: encontrado.rol,
    permisos: encontrado.permisos,
    verPersonas: encontrado.verPersonas,
  });

  await registrarAuditoria({
    accion: "login_exitoso",
    actor: encontrado.email,
    detalle: `rol=${encontrado.rol}`,
  });

  return NextResponse.json({ ok: true });
}
