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

  reactStrictMode: true,
};

export default nextConfig;
