/**
 * Conexión a Postgres para los scripts de línea de comandos.
 *
 * Usa el driver `pg` clásico (no el serverless de Neon) porque los scripts
 * corren en Node, hacen muchas escrituras seguidas y necesitan transacciones
 * reales — que es justo donde el driver HTTP no sirve.
 *
 * La app web sí usa `@neondatabase/serverless`: ahí las consultas son de
 * lectura, sueltas, y desde funciones serverless.
 */

import { readFileSync } from "node:fs";
import { Client } from "pg";

/** Carga `.env` sin dependencias externas — es un parser mínimo a propósito. */
export function cargarEnv(ruta = ".env"): void {
  let contenido: string;
  try {
    contenido = readFileSync(ruta, "utf8");
  } catch {
    return; // sin .env: se usan las variables del entorno (caso Vercel/CI)
  }

  for (const linea of contenido.split("\n")) {
    const limpia = linea.trim();
    if (!limpia || limpia.startsWith("#")) continue;
    const i = limpia.indexOf("=");
    if (i === -1) continue;
    const clave = limpia.slice(0, i).trim();
    let valor = limpia.slice(i + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    // Windows: `vercel env pull` y algunos editores dejan \r al final,
    // y un \r invisible al final de una connection string la rompe.
    valor = valor.replace(/\r$/, "");
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}

export async function conectar(): Promise<Client> {
  cargarEnv();

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Copia .env.example a .env y pega la connection string de Neon.\n" +
        "Ver CLAUDE.md § 4 — Conectar la base de datos.",
    );
  }

  const cliente = new Client({
    connectionString: url,
    // Neon exige TLS. `rejectUnauthorized: false` evita el error de cadena de
    // certificados en Windows sin desactivar el cifrado.
    ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });

  await cliente.connect();
  return cliente;
}
