import { Pool, type PoolClient } from "pg";

/**
 * Conexión a Postgres para la app.
 *
 * Se usa un Pool y no un Client suelto porque en serverless cada invocación
 * puede reutilizar el proceso: abrir una conexión nueva por request agota
 * rápido el límite de conexiones de Neon. El pool se guarda en `globalThis`
 * para que sobreviva al hot reload de desarrollo, que si no crea un pool nuevo
 * en cada recompilación hasta tumbar la base.
 */

declare global {
  var __sittiPool: Pool | undefined;
}

/** ¿La base corre en la misma máquina? Solo ahí se acepta ir sin TLS. */
function esLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false; // URL rara: se asume remota y se exige TLS.
  }
}

export function pool(): Pool {
  if (globalThis.__sittiPool) return globalThis.__sittiPool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "Falta DATABASE_URL. Con DEMO_MODE=false la app necesita la base. Ver CLAUDE.md § 4.",
    );
  }

  const p = new Pool({
    connectionString: url,
    // Pocas conexiones a propósito: son ~15 usuarios y Neon en plan gratuito
    // tiene un tope bajo. Más conexiones no darían más velocidad, solo errores.
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    /*
     * TLS con verificación de certificado.
     *
     * Antes iba `rejectUnauthorized: false`: el tráfico se cifraba pero no se
     * comprobaba con quién. Alguien en posición de red podía interponerse y
     * leer los hashes de `auth.usuarios`, la tabla de tickets y el propio
     * DATABASE_URL. Neon presenta un certificado válido de CA pública, así que
     * verificar no cuesta nada.
     *
     * El host se lee parseando la URL, no con `includes("localhost")`: esa
     * heurística desactivaba TLS si la CONTRASEÑA contenía esa subcadena.
     */
    ssl: esLocal(url) ? undefined : { rejectUnauthorized: true },
  });

  globalThis.__sittiPool = p;
  return p;
}

/** Corre una función con un cliente dedicado y lo devuelve al pool pase lo que pase. */
export async function conCliente<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool().connect();
  try {
    return await fn(cliente);
  } finally {
    cliente.release();
  }
}
