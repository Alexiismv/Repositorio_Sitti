import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

import type { Sesion } from "@/lib/auth/tipos";
import { claveSecreta } from "@/lib/auth/clave";

/**
 * Sesión "pendiente de cambio de contraseña" (spec 1.3, flujo de reset del
 * administrador). Cookie SEPARADA de `sitti_sesion` y mutuamente excluyente
 * con ella — un usuario con `debe_cambiar_password = true` recibe ESTA
 * cookie al loguearse con la contraseña por defecto, nunca la de sesión
 * completa. Así ningún API route puede saltarse el flujo llamándolo
 * directo: la cookie que trae no alcanza a decodificar como `Sesion` real,
 * porque no lleva `permisos`/`rol`, solo lo mínimo para completar el cambio.
 */
export const COOKIE_CAMBIO_PENDIENTE = "sitti_cambio_pendiente";
const DURACION_PENDIENTE_SEGUNDOS = 15 * 60; // 15 minutos: alcanza para cambiar la contraseña, no para quedar "colgado" logueado a medias

export interface SesionPendiente {
  sub: string;
  email: string;
}

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
      permisos: (payload.permisos as Sesion["permisos"]) ?? [],
      perfiles: (payload.perfiles as Sesion["perfiles"]) ?? [],
      pantallas: (payload.pantallas as Sesion["pantallas"]) ?? [],
      acciones: (payload.acciones as Sesion["acciones"]) ?? {},
      widgets: (payload.widgets as Sesion["widgets"]) ?? [],
    };
  } catch {
    // Token vencido, alterado o firmado con otro secreto -> no hay sesión.
    return null;
  }
}

export async function crearSesionPendiente(datos: SesionPendiente): Promise<void> {
  const token = await new SignJWT({ email: datos.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(datos.sub)
    .setIssuedAt()
    .setExpirationTime(`${DURACION_PENDIENTE_SEGUNDOS}s`)
    .sign(claveSecreta());

  const store = await cookies();
  store.set(COOKIE_CAMBIO_PENDIENTE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: DURACION_PENDIENTE_SEGUNDOS,
  });
}

export async function leerSesionPendiente(): Promise<SesionPendiente | null> {
  const store = await cookies();
  const token = store.get(COOKIE_CAMBIO_PENDIENTE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, claveSecreta(), { algorithms: ["HS256"] });
    return { sub: String(payload.sub), email: String(payload.email) };
  } catch {
    return null;
  }
}

export async function limpiarSesionPendiente(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_CAMBIO_PENDIENTE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
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
