import { NextResponse } from "next/server";

import { leerSesion } from "@/lib/auth/sesion";
import { puedeUsarAccion, puedeVerPantalla, type Sesion } from "@/lib/auth/tipos";
import { DEMO_MODE } from "@/lib/data/provider";

/**
 * Gate compartido de los endpoints `/api/admin/**` (usuarios y perfiles).
 *
 * Fase 4: ya no verifica `rol === "administrador"` — verifica que el
 * usuario tenga la PANTALLA habilitada (`admin-usuarios` o `admin-perfiles`,
 * según quién llame) vía sus perfiles asignados, y opcionalmente la ACCIÓN
 * puntual (`crear`/`editar`/`eliminar`/`restablecer_password`) para
 * endpoints que hacen algo más específico que "ver".
 *
 * Devuelve la `Sesion` si el acceso es válido, o una `NextResponse` de error
 * lista para retornar tal cual desde el route handler.
 */
export async function requiereAdmin(
  pantalla: "admin-usuarios" | "admin-perfiles",
  accion?: string,
): Promise<Sesion | NextResponse> {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  if (!puedeVerPantalla(sesion, pantalla)) {
    return NextResponse.json({ error: "No tienes acceso a esta sección." }, { status: 403 });
  }
  if (accion && !puedeUsarAccion(sesion, pantalla, accion)) {
    return NextResponse.json({ error: "No tienes permiso para esta acción." }, { status: 403 });
  }

  if (DEMO_MODE) {
    return NextResponse.json(
      { error: "Esta función requiere Postgres real; no está disponible en modo demo." },
      { status: 503 },
    );
  }

  return sesion;
}
