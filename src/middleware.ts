import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

import { COOKIE_SESION } from "@/lib/auth/sesion";
import { claveSecreta, haySecretoUtilizable } from "@/lib/auth/clave";

/**
 * Puerta de entrada: nada de la app se ve sin sesión válida.
 *
 * Ojo con lo que hace y lo que NO hace este middleware:
 *  - SÍ: redirige a /login si no hay cookie válida. Es UX + primera barrera.
 *  - NO: es la única defensa. Cada página vuelve a leer la sesión en el servidor
 *    y el proveedor de datos recorta por permisos. Si algún día alguien cambia
 *    el `matcher` y se le escapa una ruta, los datos siguen protegidos.
 */

/*
 * Coincidencia EXACTA, no por prefijo.
 *
 * Antes se aceptaba `pathname.startsWith("/login/")`, así que cualquier ruta
 * futura colgada de ahí abajo —un `/api/auth/login/reset`, por ejemplo—
 * habría nacido pública sin que nadie lo notara.
 */
const RUTAS_PUBLICAS = new Set(["/login", "/api/auth/login"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (RUTAS_PUBLICAS.has(pathname)) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_SESION)?.value;
  let valida = false;

  /*
   * Sin secreto utilizable no se valida nada: se trata la request como si no
   * tuviera sesión. Antes se caía a un secreto escrito en el repositorio, así
   * que una variable de entorno mal puesta convertía esta puerta en una que
   * acepta cookies falsificadas. Ahora falla cerrada.
   */
  if (token && haySecretoUtilizable()) {
    try {
      await jwtVerify(token, claveSecreta(), { algorithms: ["HS256"] });
      valida = true;
    } catch {
      valida = false; // vencida (2h) o alterada
    }
  }

  if (valida) return NextResponse.next();

  // Las rutas de API responden 401; solo las páginas redirigen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Todo excepto assets estáticos y el favicon.
    "/((?!_next/static|_next/image|favicon.ico|logo-sitti.png|geo/).*)",
  ],
};
