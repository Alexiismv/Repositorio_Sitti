import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { requiereAdmin } from "@/lib/auth/requiere-admin";
import { conCliente } from "@/lib/db";
import { registrarAuditoria, registrarError } from "@/lib/logs";

const PASSWORD_POR_DEFECTO = "admin";

/**
 * Flujo de "Restablecer contraseña" (spec 1.3): la fija al valor por
 * defecto y marca `debe_cambiar_password = true`. El siguiente login de ese
 * usuario cae en `/cambio-password-obligatorio` (ver middleware) antes de
 * darle acceso — este endpoint por sí solo no le abre ninguna puerta al
 * usuario afectado, solo prepara la cuenta para que la abra él mismo.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resultado = await requiereAdmin("admin-usuarios", "restablecer_password");
  if (resultado instanceof NextResponse) return resultado;
  const sesion = resultado;

  const { id } = await params;

  try {
    const hash = await bcrypt.hash(PASSWORD_POR_DEFECTO, 12);
    const r = await conCliente((cliente) =>
      cliente.query<{ email: string }>(
        `UPDATE auth.usuarios
         SET password_hash = $1, debe_cambiar_password = true, actualizado_en = now()
         WHERE id = $2
         RETURNING email`,
        [hash, id],
      ),
    );
    const fila = r.rows[0];
    if (!fila) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    await registrarAuditoria({
      accion: "password_restablecida_admin",
      actor: sesion.email,
      detalle: `usuario_afectado=${fila.email}`,
    });

    return NextResponse.json({ ok: true, email: fila.email });
  } catch (e) {
    const crudo = e instanceof Error ? e.message : "Error desconocido";
    await registrarError({ origen: "api", mensaje: "Fallo al restablecer contraseña", detalle: crudo });
    return NextResponse.json({ error: "No se pudo restablecer la contraseña." }, { status: 500 });
  }
}
