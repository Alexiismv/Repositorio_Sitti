import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import type { Sesion } from "@/lib/auth/tipos";
import { claveSecreta } from "@/lib/auth/clave";

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

/*
 * La derivación de la clave vive en `@/lib/auth/clave`, compartida con el
 * middleware. Antes había una copia acá y otra allá con reglas distintas, y la
 * del middleware no fallaba nunca: usaba un secreto del repositorio sin
 * condición alguna.
 */

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
    // `algorithms` fija HS256: sin la lista blanca se acepta cualquier HS*.
    const { payload } = await jwtVerify(token, claveSecreta(), { algorithms: ["HS256"] });
    return {
      sub: String(payload.sub),
      email: String(payload.email),
      nombre: String(payload.nombre),
      rol: payload.rol as Sesion["rol"],
      permisos: (payload.permisos as Sesion["permisos"]) ?? [],
      verPersonas: Boolean(payload.verPersonas),
    };
  } catch {
    // Token vencido, alterado o firmado con otro secreto -> no hay sesión.
    return null;
  }
}

export async function cerrarSesion(): Promise<void> {
  const store = await cookies();
  // Mismos atributos que al crearla: si algún día se le agrega un `domain`,
  // un borrado con atributos distintos dejaría la cookie viva.
  store.set(COOKIE_SESION, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
