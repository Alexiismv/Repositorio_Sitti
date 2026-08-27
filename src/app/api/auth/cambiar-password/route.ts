import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { leerSesion } from "@/lib/auth/sesion";
import { validarPasswordNueva } from "@/lib/auth/password";
import { conCliente } from "@/lib/db";
import { DEMO_MODE } from "@/lib/data/provider";
import { registrarAuditoria } from "@/lib/logs";

const esquema = z.object({
  passwordActual: z.string().min(1).max(200),
  passwordNueva: z.string().min(1).max(200),
});

/**
 * Autoservicio: cada usuario cambia su propia contraseña.
 *
 * No es un endpoint de administrador — solo toca la fila del usuario de la
 * sesión (`sesion.sub`), nunca un `id` que venga del cuerpo de la petición.
 * Requiere la contraseña actual para confirmar que quien está frente al
 * teclado es el dueño de la cuenta (una cookie robada no basta).
 */
export async function POST(req: Request) {
  const sesion = await leerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "Sesión no válida. Vuelve a iniciar sesión." }, { status: 401 });
  }

  if (DEMO_MODE) {
    return NextResponse.json(
      { error: "En modo demo las cuentas son fijas y no se pueden cambiar. Esto funciona con Postgres conectado (DEMO_MODE=false)." },
      { status: 400 },
    );
  }

  let cuerpo: unknown;
  try {
    cuerpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const parsed = esquema.safeParse(cuerpo);
  if (!parsed.success) {
    return NextResponse.json({ error: "Faltan datos en la solicitud." }, { status: 400 });
  }

  const { passwordActual, passwordNueva } = parsed.data;

  const faltante = validarPasswordNueva(passwordNueva);
  if (faltante) {
    return NextResponse.json(
      { error: `La contraseña nueva no cumple un requisito: ${faltante}.` },
      { status: 400 },
    );
  }

  const resultado = await conCliente(async (cliente) => {
    const r = await cliente.query<{ password_hash: string }>(
      `SELECT password_hash FROM auth.usuarios WHERE id = $1 AND activo`,
      [sesion.sub],
    );
    const fila = r.rows[0];
    if (!fila) return { ok: false as const, error: "No encontramos tu cuenta." };

    const coincideActual = await bcrypt.compare(passwordActual, fila.password_hash);
    if (!coincideActual) {
      return { ok: false as const, error: "La contraseña actual no es correcta." };
    }

    // Comparamos contra el HASH, no contra el texto que escribió el usuario:
    // así detectamos "la misma contraseña" incluso si en el campo "actual"
    // puso algo distinto por error.
    const igualALaAnterior = await bcrypt.compare(passwordNueva, fila.password_hash);
    if (igualALaAnterior) {
      return { ok: false as const, error: "La contraseña nueva no puede ser igual a la anterior." };
    }

    const nuevoHash = await bcrypt.hash(passwordNueva, 12);
    await cliente.query(`UPDATE auth.usuarios SET password_hash = $1 WHERE id = $2`, [
      nuevoHash,
      sesion.sub,
    ]);

    return { ok: true as const };
  });

  if (!resultado.ok) {
    await registrarAuditoria({
      accion: "password_cambio_fallido",
      actor: sesion.email,
      detalle: resultado.error,
    });
    return NextResponse.json({ error: resultado.error }, { status: 400 });
  }

  await registrarAuditoria({
    accion: "password_cambiada",
    actor: sesion.email,
    detalle: "Cambio realizado por el propio usuario",
  });

  return NextResponse.json({ ok: true });
}
