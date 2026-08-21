/**
 * Crea el primer usuario ADMINISTRADOR.
 *
 *   npm run db:seed -- --admin-email tu.usuario --admin-password "una-contraseña-larga"
 *
 * No hay autoregistro en esta app (decisión confirmada): las cuentas las crea
 * el Administrador. Este script existe solo para crear la PRIMERA, porque si
 * no habría un problema del huevo y la gallina.
 *
 * La contraseña se guarda con bcrypt, nunca en texto plano.
 */

import bcrypt from "bcryptjs";

import { conectar } from "./db";

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("admin-email");
  const password = arg("admin-password");
  const nombre = arg("admin-nombre") ?? "Administrador SITTI";

  if (!email || !password) {
    console.error(
      'Uso: npm run db:seed -- --admin-email tu.usuario --admin-password "..." [--admin-nombre "Nombre Apellido"]',
    );
    process.exit(1);
  }

  if (password.length < 12) {
    // 12 caracteres no es un capricho: esta cuenta puede crear y desactivar
    // todas las demás. Es la llave maestra del panel.
    console.error("❌ La contraseña del administrador debe tener al menos 12 caracteres.");
    process.exit(1);
  }

  const cliente = await conectar();

  try {
    const hash = await bcrypt.hash(password, 12);

    const res = await cliente.query<{ id: string }>(
      `INSERT INTO auth.usuarios (email, nombre, password_hash, rol, activo)
       VALUES ($1, $2, $3, 'administrador', true)
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             nombre = EXCLUDED.nombre,
             activo = true
       RETURNING id`,
      [email, nombre, hash],
    );

    const id = res.rows[0].id;

    // El administrador ve todo: una sola fila de permiso con comodines.
    await cliente.query(
      `INSERT INTO auth.usuario_permiso (usuario_id, sede_slug, area_slug)
       VALUES ($1, '*', '*') ON CONFLICT DO NOTHING`,
      [id],
    );

    await cliente.query(
      `INSERT INTO auth.audit_log (actor, accion, detalle)
       VALUES ($1, 'usuario_creado', 'administrador inicial creado por seed')`,
      [email],
    );

    console.log(`\n✅ Administrador listo: ${email}`);
    console.log("   Guarda esa contraseña en un gestor — desde esta cuenta se crean las demás.");
    console.log("\n   Siguiente paso: correr el ETL (npm run etl -- --dry-run) y luego DEMO_MODE=false.");
  } finally {
    await cliente.end();
  }
}

main().catch((e) => {
  console.error("\n❌ Falló el seed:\n", e instanceof Error ? e.message : e);
  process.exit(1);
});
