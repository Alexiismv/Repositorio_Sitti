import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { construirSesion } from "@/lib/auth/construir-sesion";
import { validarPasswordNueva } from "@/lib/auth/password";
import { crearSesion, leerSesionPendiente, limpiarSesionPendiente } from "@/lib/auth/sesion";
import { conCliente } from "@/lib/db";
import { registrarAuditoria } from "@/lib/logs";

const esquema = z.object({ passwordNueva: z.string().min(1).max(200) });

/**
 * Completa el flujo de cambio obligatorio (spec 1.3 punto 4): valida la
 * sesión pendiente (no una sesión completa — ese es justo el punto), fija la
 * contraseña nueva, limpia el flag `debe_cambiar_password`, y RECIÉN ahí
 * emite la sesión completa (armada por `construirSesion()`, la misma lógica
 * que usa el login normal — ver Fase 4 de la migración a perfiles). Antes de
 * este endpoint, el usuario no tiene ningún acceso real al sistema.
 */
export async function POST(req: Request) {
  const pendiente = await leerSesionPendiente();
  if (!pendiente) {
    return NextResponse.json(
      { error: "El enlace de cambio de contraseña venció. Vuelve a iniciar sesión." },
      { status: 401 },
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
    return NextResponse.json({ error: "Falta la contraseña nueva." }, { status: 400 });
  }

  const faltante = validarPasswordNueva(parsed.data.passwordNueva);
  if (faltante) {
    return NextResponse.json(
      { error: `La contraseña nueva no cumple un requisito: ${faltante}.` },
      { status: 400 },
    );
  }

  const actualizado = await conCliente(async (cliente) => {
    const hash = await bcrypt.hash(parsed.data.passwordNueva, 12);
    const r = await cliente.query(
      `UPDATE auth.usuarios
       SET password_hash = $1, debe_cambiar_password = false, actualizado_en = now()
       WHERE id = $2
       RETURNING id`,
      [hash, pendiente.sub],
    );
    return r.rows.length > 0;
  });

  if (!actualizado) {
    return NextResponse.json({ error: "No encontramos tu cuenta." }, { status: 404 });
  }

  const sesion = await construirSesion(pendiente.sub);
  if (!sesion) {
    return NextResponse.json({ error: "No se pudo completar el inicio de sesión." }, { status: 500 });
  }

  await limpiarSesionPendiente();
  await crearSesion(sesion);

  await registrarAuditoria({
    accion: "password_cambio_obligatorio_completado",
    actor: sesion.email,
  });

  return NextResponse.json({ ok: true });
}
