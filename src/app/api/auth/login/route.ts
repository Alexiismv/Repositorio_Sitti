import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { construirSesion } from "@/lib/auth/construir-sesion";
import { crearSesion, crearSesionPendiente } from "@/lib/auth/sesion";
import { buscarUsuarioDemo, sesionDesdeUsuarioDemo } from "@/lib/auth/usuarios-demo";
import { conCliente } from "@/lib/db";
import { DEMO_MODE } from "@/lib/data/provider";
import { registrarAuditoria } from "@/lib/logs";

/**
 * Hash señuelo, coste 12 — el mismo de las contraseñas reales.
 *
 * Se compara contra él cuando el usuario NO existe, para que ese camino tarde
 * lo mismo que el de un usuario que sí existe. No es un secreto: su texto
 * original se generó al azar y se descartó, así que ninguna contraseña
 * coincide con él jamás.
 */
const HASH_SENUELO = "$2b$12$6jJ09aR1OBG2LqqPz8aWVOGNmw7ZTwml3zS9b48VQspk2tLZu.JfS";

interface FilaCredencial {
  id: string;
  email: string;
  password_hash: string;
  debe_cambiar_password: boolean;
}

/**
 * Verifica credenciales contra Postgres. Ya NO arma la `Sesion` acá: desde
 * la Fase 4 de la migración a perfiles, eso es trabajo de `construirSesion()`
 * (una sola vez, después de decidir que no hay cambio de contraseña
 * pendiente) — `autenticarPostgres` solo confirma quién es y si puede pasar.
 *
 * `SELECT *` está prohibido en tablas con datos de personas (CLAUDE.md § 2.2
 * regla 10) — se enumeran columnas explícitas, sin traer `password_hash` más
 * de lo necesario para la comparación.
 */
async function autenticarPostgres(
  usuario: string,
  password: string,
): Promise<{ id: string; email: string; debeCambiarPassword: boolean } | null> {
  return conCliente(async (cliente) => {
    const r = await cliente.query<FilaCredencial>(
      `SELECT id, email, password_hash, debe_cambiar_password
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

    return { id: fila.id, email: fila.email, debeCambiarPassword: fila.debe_cambiar_password };
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

  if (DEMO_MODE) {
    const demo = buscarUsuarioDemo(usuario, password);
    if (!demo) {
      await registrarAuditoria({ accion: "login_fallido", actor: usuario, detalle: "Credenciales inválidas", ip });
      return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
    }

    await crearSesion({
      sub: demo.id,
      email: demo.email,
      nombre: demo.nombre,
      permisos: demo.permisos,
      ...sesionDesdeUsuarioDemo(demo),
    });
    await registrarAuditoria({ accion: "login_exitoso", actor: demo.email, detalle: `perfil_demo=${demo.rol}`, ip });
    return NextResponse.json({ ok: true });
  }

  const encontrado = await autenticarPostgres(usuario, password);
  if (!encontrado) {
    await registrarAuditoria({ accion: "login_fallido", actor: usuario, detalle: "Credenciales inválidas", ip });
    // Mensaje deliberadamente genérico: no revelamos si el usuario existe.
    return NextResponse.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
  }

  if (encontrado.debeCambiarPassword) {
    await crearSesionPendiente({ sub: encontrado.id, email: encontrado.email });
    await registrarAuditoria({
      accion: "login_cambio_pendiente",
      actor: encontrado.email,
      detalle: "Contraseña por defecto: se exige cambio antes de dar acceso",
      ip,
    });
    return NextResponse.json({ ok: true, cambioPendiente: true });
  }

  const sesion = await construirSesion(encontrado.id);
  if (!sesion) {
    // No debería pasar: el usuario se acaba de autenticar contra esta misma
    // fila. Si pasa (borrado concurrente entre el SELECT y acá), es un 500
    // limpio, no una sesión a medio construir.
    return NextResponse.json({ error: "No se pudo iniciar sesión." }, { status: 500 });
  }

  await crearSesion(sesion);
  await registrarAuditoria({
    accion: "login_exitoso",
    actor: sesion.email,
    detalle: `perfiles=${sesion.perfiles.join(",") || "(ninguno)"}`,
    ip,
  });

  return NextResponse.json({ ok: true });
}
