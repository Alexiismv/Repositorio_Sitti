import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

import { COOKIE_SESION } from "@/lib/auth/sesion";

/**
 * Puerta de entrada: nada de la app se ve sin sesión válida.
 *
 * Ojo con lo que hace y lo que NO hace este middleware:
 *  - SÍ: redirige a /login si no hay cookie válida. Es UX + primera barrera.
 *  - NO: es la única defensa. Cada página vuelve a leer la sesión en el servidor
 *    y el proveedor de datos recorta por permisos. Si algún día alguien cambia
 *    el `matcher` y se le escapa una ruta, los datos siguen protegidos.
 */

const RUTAS_PUBLICAS = ["/login", "/api/auth/login"];

function claveSecreta(): Uint8Array {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto || secreto.length < 32) {
    return new TextEncoder().encode("sitti-demo-secret-no-usar-en-produccion-32b");
  }
  return new TextEncoder().encode(secreto);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_SESION)?.value;
  let valida = false;

  if (token) {
    try {
      await jwtVerify(token, claveSecreta());
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
