import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` deja un server mínimo en .next/standalone -> imagen Docker chica.
  // En Vercel no estorba: la plataforma usa su propio empaquetado.
  output: "standalone",

  // Ancla el rastreo de archivos a ESTA carpeta. Sin esto, si el repo queda
  // dentro de otra carpeta que tenga su propio lockfile, Next infiere mal la
  // raíz y el build de Docker/Vercel puede empacar de más o de menos.
  outputFileTracingRoot: path.join(import.meta.dirname ?? process.cwd()),

  /*
   * `@react-pdf/renderer` usa `pdfkit` por debajo, que carga sus fuentes
   * estándar (Helvetica, etc.) con un `require()` armado en tiempo de
   * ejecución a partir de un nombre — el rastreo estático de Next no puede
   * seguir eso, así que con `output: "standalone"` esos archivos se quedan
   * fuera del bundle y el endpoint truena en Vercel con "Cannot find module
   * .../pdfkit/js/standard-fonts/Helvetica.cjs" aunque en local funcione
   * perfecto (local lee directo de `node_modules` en disco, sin bundle).
   * Confirmado con un fallo real en producción (28 ago 2026).
   */
  outputFileTracingIncludes: {
    "/api/export/**/*": ["./node_modules/pdfkit/js/standard-fonts/**/*"],
  },

  reactStrictMode: true,

  // No anunciar el framework y su versión en cada respuesta.
  poweredByHeader: false,

  /*
   * Cabeceras de seguridad.
   *
   * Existían en `nginx/nginx.conf`, pero ese archivo solo se usa en el
   * despliegue por Docker en VM propia: en Vercel nunca se ejecuta, así que la
   * URL pública salía sin ninguna. Definidas acá aplican en los dos caminos.
   *
   * La CSP va en `Report-Only` a propósito, sin bloquear todavía. Dos cosas la
   * romperían hoy si estuviera activa: el script inline que fija el tema antes
   * del primer pintado (`layout.tsx`) y MapLibre, que levanta sus workers desde
   * `blob:`. Ambos están contemplados en la política, pero conviene ver el
   * reporte real de violaciones antes de promoverla a bloqueante.
   */
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      // 'unsafe-inline' cubre el script de tema; se quita al pasar a nonce.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://tile.openstreetmap.org https://*.tile.openstreetmap.org https://api.maptiler.com",
      "connect-src 'self' https://api.maptiler.com https://tile.openstreetmap.org https://*.tile.openstreetmap.org",
      "worker-src 'self' blob:",
      "font-src 'self' data:",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking: el login es público y es un formulario de credenciales.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "Content-Security-Policy-Report-Only", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
