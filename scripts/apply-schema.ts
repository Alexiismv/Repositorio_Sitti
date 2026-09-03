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

import { ACCESO_PERSONAS, ACCESO_POR_ROL, ACCIONES, PANTALLAS, PANTALLA_ACCION, WIDGETS } from "../src/lib/auth/modulos";
import { AREAS, GERENCIAS, PROYECTOS, SEDES } from "../src/lib/catalogo";
import { conectar } from "./db";
import type { Client } from "pg";

/** Nombre del perfil puente que hereda el acceso de cada `rol` legado. */
const PERFIL_POR_ROL: Record<string, string> = {
  administrador: "Administrador",
  gerente: "Gerente",
  coordinador: "Coordinador",
};

/**
 * Perfiles puente "Gerente" y "Coordinador" — reproducen el acceso que hoy da
 * el enum `rol`, para que la migración a perfiles (Fase 4) no deje a nadie
 * sin acceso. Son perfiles NORMALES (no `es_sistema`), editables por un
 * administrador desde `/admin/perfiles` una vez creados.
 *
 * "Administrador" no está acá: se siembra aparte con acceso TOTAL (sección
 * de abajo), automáticamente igualado a todo lo que haya en `modulos.ts`.
 */
const PERFILES_PUENTE: {
  nombre: string;
  descripcion: string;
  pantallas: string[];
  acciones: Record<string, string[]>;
  widgets: string[];
}[] = [
  {
    nombre: "Gerente",
    descripcion: "Acceso operativo total: ve todas las gerencias, áreas y sedes. No administra usuarios ni perfiles.",
    ...ACCESO_POR_ROL.gerente,
  },
  {
    nombre: "Coordinador",
    descripcion: "Acceso operativo recortado por sede/área asignada. No sincroniza con Jira ni administra usuarios.",
    ...ACCESO_POR_ROL.coordinador,
  },
];

/**
 * Perfil auxiliar que reemplaza al viejo flag `auth.usuarios.ver_personas`
 * (permiso suelto, por usuario, no derivado del rol). `migrarVerPersonas()`
 * se lo asigna a todo usuario que tuviera ese flag en `true` y no haya
 * ganado ya acceso a "Personas" por otro de sus perfiles — así nadie pierde
 * un acceso que ya tenía al apagarse el flag en la Fase 4 de la migración.
 */
const PERFIL_ACCESO_PERSONAS = {
  nombre: "Acceso a Personas",
  descripcion: 'Solo agrega la pantalla "Personas" — pensado para sumarlo a otro perfil, no para usarlo solo.',
  ...ACCESO_PERSONAS,
};

const PERFILES_NO_SISTEMA = [...PERFILES_PUENTE, PERFIL_ACCESO_PERSONAS];

/**
 * Siembra el catálogo de pantallas/acciones/widgets, el perfil "Administrador"
 * (con acceso total, recalculado en cada corrida) y los perfiles puente
 * Gerente/Coordinador. Todo idempotente: `ON CONFLICT DO NOTHING/UPDATE`.
 */
async function sembrarPerfiles(cliente: Client): Promise<void> {
  await cliente.query("BEGIN");
  try {
    for (const p of PANTALLAS) {
      await cliente.query(
        `INSERT INTO auth.pantallas (slug, nombre, orden) VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden`,
        [p.slug, p.nombre, p.orden],
      );
    }
    for (const a of ACCIONES) {
      await cliente.query(
        `INSERT INTO auth.acciones (slug, nombre) VALUES ($1, $2)
         ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre`,
        [a.slug, a.nombre],
      );
    }
    for (const [pantalla, acciones] of Object.entries(PANTALLA_ACCION)) {
      for (const accion of acciones) {
        await cliente.query(
          `INSERT INTO auth.pantalla_accion (pantalla_slug, accion_slug) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [pantalla, accion],
        );
      }
    }
    for (const w of WIDGETS) {
      await cliente.query(
        `INSERT INTO auth.widgets (slug, pantalla_slug, nombre, orden) VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE
           SET pantalla_slug = EXCLUDED.pantalla_slug, nombre = EXCLUDED.nombre, orden = EXCLUDED.orden`,
        [w.slug, w.pantalla, w.nombre, w.orden],
      );
    }

    // "Administrador": perfil de sistema con acceso TOTAL, recalculado cada
    // vez — así una pantalla/acción/widget nuevo se le suma solo, sin tocar
    // SQL a mano.
    const admin = await cliente.query<{ id: string }>(
      `INSERT INTO auth.perfiles (nombre, descripcion, activo, es_sistema)
       VALUES ('Administrador', 'Acceso total al sistema: todas las pantallas, acciones y gráficos.', true, true)
       ON CONFLICT (nombre) DO UPDATE SET es_sistema = true, activo = true
       RETURNING id`,
    );
    const adminId = admin.rows[0].id;
    await cliente.query(
      `INSERT INTO auth.perfil_pantalla (perfil_id, pantalla_slug)
       SELECT $1, slug FROM auth.pantallas ON CONFLICT DO NOTHING`,
      [adminId],
    );
    await cliente.query(
      `INSERT INTO auth.perfil_pantalla_accion (perfil_id, pantalla_slug, accion_slug)
       SELECT $1, pantalla_slug, accion_slug FROM auth.pantalla_accion ON CONFLICT DO NOTHING`,
      [adminId],
    );
    await cliente.query(
      `INSERT INTO auth.perfil_widget (perfil_id, widget_slug)
       SELECT $1, slug FROM auth.widgets ON CONFLICT DO NOTHING`,
      [adminId],
    );

    for (const puente of PERFILES_NO_SISTEMA) {
      const r = await cliente.query<{ id: string }>(
        `INSERT INTO auth.perfiles (nombre, descripcion, activo, es_sistema)
         VALUES ($1, $2, true, false)
         ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion
         RETURNING id`,
        [puente.nombre, puente.descripcion],
      );
      const id = r.rows[0].id;
      for (const slug of puente.pantallas) {
        await cliente.query(
          `INSERT INTO auth.perfil_pantalla (perfil_id, pantalla_slug) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, slug],
        );
      }
      for (const [pantalla, acciones] of Object.entries(puente.acciones)) {
        for (const accion of acciones) {
          await cliente.query(
            `INSERT INTO auth.perfil_pantalla_accion (perfil_id, pantalla_slug, accion_slug)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [id, pantalla, accion],
          );
        }
      }
      for (const slug of puente.widgets) {
        await cliente.query(
          `INSERT INTO auth.perfil_widget (perfil_id, widget_slug) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, slug],
        );
      }
    }

    await cliente.query("COMMIT");
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw e;
  }
}

/**
 * A todo usuario existente que NO tenga ninguna fila en `usuario_perfil`, le
 * asigna el perfil puente que corresponde a su `rol` actual — para que nadie
 * quede sin acceso el día que Fase 4 deje de leer `rol`. Segura de re-correr:
 * un usuario que ya tiene perfiles asignados (por el CRUD de Fase 2, por
 * ejemplo) no se toca.
 */
async function migrarUsuariosSinPerfil(cliente: Client): Promise<void> {
  const usuarios = await cliente.query<{ id: string; email: string; rol: string }>(
    `SELECT u.id, u.email, u.rol
     FROM auth.usuarios u
     WHERE NOT EXISTS (SELECT 1 FROM auth.usuario_perfil up WHERE up.usuario_id = u.id)`,
  );

  let migrados = 0;
  for (const u of usuarios.rows) {
    const nombrePerfil = PERFIL_POR_ROL[u.rol];
    if (!nombrePerfil) {
      console.warn(`  ⚠ Usuario ${u.email} tiene rol desconocido "${u.rol}" — no se le asignó perfil.`);
      continue;
    }
    const perfil = await cliente.query<{ id: string }>(`SELECT id FROM auth.perfiles WHERE nombre = $1`, [
      nombrePerfil,
    ]);
    if (!perfil.rows[0]) continue;

    await cliente.query(
      `INSERT INTO auth.usuario_perfil (usuario_id, perfil_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [u.id, perfil.rows[0].id],
    );
    migrados++;
  }

  console.log(
    `→ Perfiles migrados desde \`rol\`: ${migrados} usuario(s) de ${usuarios.rows.length} sin perfil previo.`,
  );
}

/**
 * A todo usuario con `ver_personas = true` que NO tenga ya acceso a la
 * pantalla "personas" a través de alguno de sus perfiles, le asigna el
 * perfil auxiliar "Acceso a Personas" — para que apagar el flag legado en la
 * Fase 4 no le quite a nadie un acceso que ya tenía. Segura de re-correr:
 * si ya tiene acceso (por este perfil o por otro), no hace nada.
 */
async function migrarVerPersonas(cliente: Client): Promise<void> {
  const accesoPersonas = await cliente.query<{ id: string }>(
    `SELECT id FROM auth.perfiles WHERE nombre = $1`,
    [PERFIL_ACCESO_PERSONAS.nombre],
  );
  const perfilId = accesoPersonas.rows[0]?.id;
  if (!perfilId) return; // no debería pasar: se siembra en sembrarPerfiles()

  const usuarios = await cliente.query<{ id: string; email: string }>(
    `SELECT u.id, u.email
     FROM auth.usuarios u
     WHERE u.ver_personas
       AND NOT EXISTS (
         SELECT 1
         FROM auth.usuario_perfil up
         JOIN auth.perfil_pantalla pp ON pp.perfil_id = up.perfil_id
         WHERE up.usuario_id = u.id AND pp.pantalla_slug = 'personas'
       )`,
  );

  for (const u of usuarios.rows) {
    await cliente.query(
      `INSERT INTO auth.usuario_perfil (usuario_id, perfil_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [u.id, perfilId],
    );
  }

  console.log(`→ Acceso a Personas migrado: ${usuarios.rows.length} usuario(s) con \`ver_personas=true\` sin ese acceso vía perfil.`);
}

/**
 * `veTodo()` (src/lib/auth/tipos.ts) dejó de mirar `rol` — ahora solo mira si
 * existe una fila comodín `('*','*')` en `usuario_permiso`. Antes, esa
 * visibilidad total salía GRATIS con `rol IN ('gerente','administrador')`;
 * para que nadie pierda alcance de datos al completarse la Fase 4, todo
 * usuario cuyo `rol` actual sea uno de esos dos recibe la fila comodín si no
 * la tiene. `scripts/seed-demo.ts` ya hace esto mismo para el administrador
 * inicial — acá se generaliza a cualquier usuario existente.
 */
async function migrarComodinDeDatos(cliente: Client): Promise<void> {
  const usuarios = await cliente.query<{ id: string; email: string }>(
    `SELECT u.id, u.email
     FROM auth.usuarios u
     WHERE u.rol IN ('gerente', 'administrador')
       AND NOT EXISTS (
         SELECT 1 FROM auth.usuario_permiso up
         WHERE up.usuario_id = u.id AND up.sede_slug = '*' AND up.area_slug = '*'
       )`,
  );

  for (const u of usuarios.rows) {
    await cliente.query(
      `INSERT INTO auth.usuario_permiso (usuario_id, sede_slug, area_slug) VALUES ($1, '*', '*')
       ON CONFLICT DO NOTHING`,
      [u.id],
    );
  }

  console.log(`→ Comodín de datos ('*','*') migrado: ${usuarios.rows.length} usuario(s) gerente/administrador sin él.`);
}

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

    await sembrarPerfiles(cliente);
    console.log(
      `→ Perfiles sembrados: Administrador (acceso total) · ${PERFILES_NO_SISTEMA.map((p) => p.nombre).join(" · ")}`,
    );

    await migrarUsuariosSinPerfil(cliente);
    await migrarVerPersonas(cliente);
    await migrarComodinDeDatos(cliente);

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
