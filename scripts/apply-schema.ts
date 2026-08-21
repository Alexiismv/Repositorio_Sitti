/**
 * Aplica `db/schema.sql` y siembra el catálogo de negocio.
 *
 *   npm run db:schema
 *
 * Es idempotente: se puede correr las veces que haga falta. Todo es
 * `CREATE ... IF NOT EXISTS` y los INSERT del catálogo usan
 * `ON CONFLICT DO UPDATE`, así que no duplica ni pierde nada.
 *
 * ⚠️ Este script NO borra datos. Si algún día hace falta recrear una tabla,
 * eso lo hace una persona a mano y a conciencia — no un script que alguien
 * puede correr sin leer.
 */

import { readFileSync } from "node:fs";

import { AREAS, GERENCIAS, PROYECTOS, SEDES } from "../src/lib/catalogo";
import { conectar } from "./db";

async function main() {
  const cliente = await conectar();
  console.log("→ Conectado a la base de datos");

  try {
    await cliente.query(readFileSync("db/schema.sql", "utf8"));
    console.log("→ Esquemas creados (jira_cache, catalogo, auth)");

    // El catálogo se siembra desde `src/lib/catalogo.ts` para que la base y la
    // app no puedan desincronizarse: hay una sola fuente de verdad.
    await cliente.query("BEGIN");

    for (const g of GERENCIAS) {
      await cliente.query(
        `INSERT INTO catalogo.gerencias (slug, nombre, color) VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre, color = EXCLUDED.color`,
        [g.slug, g.nombre, g.color],
      );
    }

    for (const a of AREAS) {
      await cliente.query(
        `INSERT INTO catalogo.areas (slug, nombre, gerencia_slug, volumen_2026) VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE
           SET nombre = EXCLUDED.nombre,
               gerencia_slug = EXCLUDED.gerencia_slug,
               volumen_2026 = EXCLUDED.volumen_2026`,
        [a.slug, a.nombre, a.gerencia, a.volumen2026],
      );
    }

    for (const s of SEDES) {
      await cliente.query(
        `INSERT INTO catalogo.sedes (slug, nombre, direccion, lat, lon, aproximado)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (slug) DO UPDATE
           SET nombre = EXCLUDED.nombre,
               direccion = EXCLUDED.direccion,
               lat = EXCLUDED.lat,
               lon = EXCLUDED.lon,
               aproximado = EXCLUDED.aproximado`,
        [s.slug, s.nombre, s.direccion, s.lat, s.lon, Boolean(s.aproximado)],
      );
    }

    for (const p of PROYECTOS) {
      await cliente.query(
        `INSERT INTO catalogo.proyectos (clave, nombre, vocabulario, campo_area, sede_fija)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (clave) DO UPDATE
           SET nombre = EXCLUDED.nombre,
               vocabulario = EXCLUDED.vocabulario,
               campo_area = EXCLUDED.campo_area,
               sede_fija = EXCLUDED.sede_fija`,
        [p.clave, p.nombre, p.vocabulario, p.campoArea, p.sedeFija ?? null],
      );
    }

    await cliente.query("COMMIT");

    console.log(
      `→ Catálogo sembrado: ${GERENCIAS.length} gerencias · ${AREAS.length} áreas · ` +
        `${SEDES.length} sedes · ${PROYECTOS.length} proyectos`,
    );
    console.log("\n✅ Listo. Siguiente paso: crear el usuario administrador");
    console.log('   npm run db:seed -- --admin-email tu.usuario --admin-password "..."');
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await cliente.end();
  }
}

main().catch((e) => {
  console.error("\n❌ Falló la aplicación del esquema:\n", e instanceof Error ? e.message : e);
  process.exit(1);
});
