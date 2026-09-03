import { NextResponse } from "next/server";

import { leerSesion } from "@/lib/auth/sesion";
import type { Sesion } from "@/lib/auth/tipos";
import { DEMO_MODE } from "@/lib/data/provider";

/**
 * Gate compartido de los endpoints `/api/admin/**`.
 *
 * Interino: verifica `rol === "administrador"`, igual que hacía la página
 * mockup de usuarios. En Fase 4, cuando el sistema de perfiles reemplace al
 * enum `rol`, este helper pasa a chequear `puedeVerPantalla`/`puedeUsarAccion`
 * — un solo lugar que actualizar, no uno por endpoint.
 *
 * Devuelve la `Sesion` si el acceso es válido, o una `NextResponse` de error
 * lista para retornar tal cual desde el route handler.
 */
export async function requiereAdmin(): Promise<Sesion | NextResponse> {
  const sesion = await leerSesion();
  if (!sesion) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  if (sesion.rol !== "administrador") {
    return NextResponse.json({ error: "Esta acción es exclusiva del Administrador." }, { status: 403 });
  }

  if (DEMO_MODE) {
    return NextResponse.json(
      { error: "Esta función requiere Postgres real; no está disponible en modo demo." },
      { status: 503 },
    );
  }

  return sesion;
}
