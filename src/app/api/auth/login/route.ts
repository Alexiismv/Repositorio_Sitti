import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { crearSesion } from "@/lib/auth/sesion";
import type { Permiso, Rol } from "@/lib/auth/tipos";
import { buscarUsuarioDemo } from "@/lib/auth/usuarios-demo";
import { conCliente } from "@/lib/db";
import { DEMO_MODE } from "@/lib/data/provider";
import { registrarAuditoria } from "@/lib/logs";

interface FilaUsuario {
  id: string;
  email: string;
  nombre: string;
  password_hash: string;
  rol: Rol;
  activo: boolean;
  ver_personas: boolean;
}

/**
 * Hash señuelo, coste 12 — el mismo de las contraseñas reales.
 *
 * Se compara contra él cuando el usuario NO existe, para que ese camino tarde
 * lo mismo que el de un usuario que sí existe. No es un secreto: su texto
 * original se generó al azar y se descartó, así que ninguna contraseña
 * coincide con él jamás.
 */
const HASH_SENUELO = "$2b$12$6jJ09aR1OBG2LqqPz8aWVOGNmw7ZTwml3zS9b48VQspk2tLZu.JfS";

/**
 * Login contra Postgres: `auth.usuarios` + `auth.usuario_permiso`.
 *
 * `SELECT *` está prohibido en tablas con datos de personas (CLAUDE.md § 2.2
 * regla 10) — se enumeran columnas explícitas, sin traer `password_hash` más
 * de lo necesario para la comparación.
 */
async function autenticarPostgres(
  usuario: string,
  password: string,
): Promise<{
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  permisos: Permiso[];
  verPersonas: boolean;
} | null> {
  return conCliente(async (cliente) => {
    const r = await cliente.query<FilaUsuario>(
      `SELECT id, email, nombre, password_hash, rol, activo, ver_personas
       FROM auth.usuarios
       WHERE lower(email) = lower($1) AND activo`,
      [usuario.trim()],
    );

    const fila = r.rows[0];
    if (!fila) {
      /*
       * Usuario inexistente: igual se paga un bcrypt contra un hash señuelo.
       *
       * Sin esto, un usuario que no existe respondía tras una sola consulta
       * mientras que uno que sí existe costaba ~300 ms de bcrypt. Esa
       * diferencia es medible sobre el ruido de red y permite enumerar las
       * cuentas reales del panel antes de atacar contraseñas — sobre todo
       * porque los usuarios son `nombre.apellido`, fáciles de adivinar.
       */
      await bcrypt.compare(password, HASH_SENUELO);
      return null;
    }

    const coincide = await bcrypt.compare(password, fila.password_hash);
    if (!coincide) return null;

    const permisosRes = await cliente.query<{ sede_slug: string; area_slug: string }>(
      `SELECT sede_slug, area_slug FROM auth.usuario_permiso WHERE usuario_id = $1`,
      [fila.id],
    );

    return {
      id: fila.id,
      email: fila.email,
      nombre: fila.nombre,
      rol: fila.rol,
      permisos: permisosRes.rows.map((p) => ({ sede: p.sede_slug, area: p.area_slug })),
      verPersonas: fila.ver_personas,
    };
  });
}

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

  // Primera IP de la cadena: la del cliente. Vercel la pone en x-forwarded-for.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

  const encontrado = DEMO_MODE
    ? buscarUsuarioDemo(usuario, password)
    : await autenticarPostgres(usuario, password);

  if (!encontrado) {
    await registrarAuditoria({
      accion: "login_fallido",
      actor: usuario,
      detalle: "Credenciales inválidas",
      ip,
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
    ip,
  });

  return NextResponse.json({ ok: true });
}
