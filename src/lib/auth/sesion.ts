import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import type { Sesion } from "@/lib/auth/tipos";

/**
 * Sesión propia de SITTI (usuario/contraseña), como quedó decidido en la
 * sección 3 del doc: nada de Azure AD por ahora — es una sorpresa para las
 * gerencias y pedir permisos de IT delataría el proyecto. El login está
 * diseñado para que migrar a SSO después sea cambiar el formulario por un
 * botón, sin rediseñar la pantalla.
 *
 * Implementación: JWT firmado (HS256) guardado en cookie httpOnly.
 * Expiración: 2 horas — confirmado en requisitos.
 */

export const COOKIE_SESION = "sitti_sesion";
export const DURACION_SESION_SEGUNDOS = 2 * 60 * 60; // 2 horas

function claveSecreta(): Uint8Array {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto || secreto.length < 32) {
    // En demo aceptamos un fallback para que `npm run dev` funcione sin configurar nada,
    // pero fuera de demo es un error duro: firmar sesiones con un secreto conocido
    // permitiría a cualquiera falsificar una cookie de gerente.
    if (process.env.DEMO_MODE !== "false") {
      return new TextEncoder().encode("sitti-demo-secret-no-usar-en-produccion-32b");
    }
    throw new Error(
      "AUTH_SECRET no está definido (o tiene menos de 32 caracteres). Genera uno con: openssl rand -base64 32",
    );
  }
  return new TextEncoder().encode(secreto);
}

export async function crearSesion(sesion: Sesion): Promise<void> {
  const token = await new SignJWT({ ...sesion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sesion.sub)
    .setIssuedAt()
    .setExpirationTime(`${DURACION_SESION_SEGUNDOS}s`)
    .sign(claveSecreta());

  const store = await cookies();
  store.set(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_SESION_SEGUNDOS,
  });
}

export async function leerSesion(): Promise<Sesion | null> {
  const store = await cookies();
  const token = store.get(COOKIE_SESION)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, claveSecreta());
    return {
      sub: String(payload.sub),
      email: String(payload.email),
      nombre: String(payload.nombre),
      rol: payload.rol as Sesion["rol"],
      permisos: (payload.permisos as Sesion["permisos"]) ?? [],
    };
  } catch {
    // Token vencido, alterado o firmado con otro secreto -> no hay sesión.
    return null;
  }
}

export async function cerrarSesion(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_SESION, "", { httpOnly: true, path: "/", maxAge: 0 });
}
