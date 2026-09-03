import type { PoolClient } from "pg";

import type { DatosPerfil } from "@/lib/validacion/perfil";
import { conCliente } from "@/lib/db";

import type { Perfil, PerfilDetalle } from "./tipos";

/** Se lanza cuando una operación se rechaza por una regla de negocio (no un error técnico). */
export class ErrorPerfil extends Error {}

interface FilaPerfil {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  es_sistema: boolean;
  cantidad_usuarios: string; // COUNT(...) llega como string desde pg
}

export interface FiltrosPerfil {
  texto?: string;
  activo?: boolean;
}

export async function listarPerfiles(filtros: FiltrosPerfil = {}): Promise<Perfil[]> {
  return conCliente(async (cliente) => {
    const condiciones: string[] = [];
    const valores: unknown[] = [];

    if (filtros.texto?.trim()) {
      valores.push(`%${filtros.texto.trim()}%`);
      condiciones.push(`p.nombre ILIKE $${valores.length}`);
    }
    if (filtros.activo !== undefined) {
      valores.push(filtros.activo);
      condiciones.push(`p.activo = $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

    const r = await cliente.query<FilaPerfil>(
      `SELECT p.id, p.nombre, p.descripcion, p.activo, p.es_sistema,
              COUNT(up.usuario_id) AS cantidad_usuarios
       FROM auth.perfiles p
       LEFT JOIN auth.usuario_perfil up ON up.perfil_id = p.id
       ${where}
       GROUP BY p.id
       ORDER BY p.nombre`,
      valores,
    );

    return r.rows.map(filaAPerfil);
  });
}

export async function obtenerPerfil(id: string): Promise<PerfilDetalle | null> {
  return conCliente(async (cliente) => {
    const r = await cliente.query<FilaPerfil>(
      `SELECT p.id, p.nombre, p.descripcion, p.activo, p.es_sistema,
              (SELECT COUNT(*) FROM auth.usuario_perfil up WHERE up.perfil_id = p.id) AS cantidad_usuarios
       FROM auth.perfiles p WHERE p.id = $1`,
      [id],
    );
    const fila = r.rows[0];
    if (!fila) return null;

    // Secuenciales, no `Promise.all`: un `PoolClient` de `pg` es una única
    // conexión y no soporta más de una query en vuelo a la vez — lanzarlas en
    // paralelo dispara el deprecation warning de `pg` ("client.query() when
    // the client is already executing a query") y, en versiones futuras,
    // dejará de funcionar.
    const pantallasRes = await cliente.query<{ pantalla_slug: string }>(
      `SELECT pantalla_slug FROM auth.perfil_pantalla WHERE perfil_id = $1`,
      [id],
    );
    const accionesRes = await cliente.query<{ pantalla_slug: string; accion_slug: string }>(
      `SELECT pantalla_slug, accion_slug FROM auth.perfil_pantalla_accion WHERE perfil_id = $1`,
      [id],
    );
    const widgetsRes = await cliente.query<{ widget_slug: string }>(
      `SELECT widget_slug FROM auth.perfil_widget WHERE perfil_id = $1`,
      [id],
    );

    const acciones: Record<string, string[]> = {};
    for (const fa of accionesRes.rows) {
      (acciones[fa.pantalla_slug] ??= []).push(fa.accion_slug);
    }

    return {
      ...filaAPerfil(fila),
      pantallas: pantallasRes.rows.map((p) => p.pantalla_slug),
      acciones,
      widgets: widgetsRes.rows.map((w) => w.widget_slug),
    };
  });
}

export async function contarUsuariosPorPerfil(id: string): Promise<number> {
  return conCliente(async (cliente) => {
    const r = await cliente.query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM auth.usuario_perfil WHERE perfil_id = $1`,
      [id],
    );
    return Number(r.rows[0]?.n ?? 0);
  });
}

async function reemplazarAsignaciones(cliente: PoolClient, perfilId: string, datos: DatosPerfil): Promise<void> {
  await cliente.query(`DELETE FROM auth.perfil_pantalla WHERE perfil_id = $1`, [perfilId]);
  await cliente.query(`DELETE FROM auth.perfil_pantalla_accion WHERE perfil_id = $1`, [perfilId]);
  await cliente.query(`DELETE FROM auth.perfil_widget WHERE perfil_id = $1`, [perfilId]);

  for (const slug of datos.pantallas) {
    await cliente.query(
      `INSERT INTO auth.perfil_pantalla (perfil_id, pantalla_slug) VALUES ($1, $2)`,
      [perfilId, slug],
    );
  }
  for (const [pantalla, acciones] of Object.entries(datos.acciones)) {
    for (const accion of acciones) {
      await cliente.query(
        `INSERT INTO auth.perfil_pantalla_accion (perfil_id, pantalla_slug, accion_slug) VALUES ($1, $2, $3)`,
        [perfilId, pantalla, accion],
      );
    }
  }
  for (const slug of datos.widgets) {
    await cliente.query(`INSERT INTO auth.perfil_widget (perfil_id, widget_slug) VALUES ($1, $2)`, [
      perfilId,
      slug,
    ]);
  }
}

export async function crearPerfil(datos: DatosPerfil): Promise<string> {
  return conCliente(async (cliente) => {
    await cliente.query("BEGIN");
    try {
      const existe = await cliente.query(`SELECT 1 FROM auth.perfiles WHERE lower(nombre) = lower($1)`, [
        datos.nombre,
      ]);
      if (existe.rows.length) throw new ErrorPerfil(`Ya existe un perfil llamado "${datos.nombre}".`);

      const r = await cliente.query<{ id: string }>(
        `INSERT INTO auth.perfiles (nombre, descripcion, activo) VALUES ($1, $2, $3) RETURNING id`,
        [datos.nombre, datos.descripcion, datos.activo],
      );
      const id = r.rows[0].id;
      await reemplazarAsignaciones(cliente, id, datos);
      await cliente.query("COMMIT");
      return id;
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      throw e;
    }
  });
}

export async function actualizarPerfil(id: string, datos: DatosPerfil): Promise<void> {
  return conCliente(async (cliente) => {
    await cliente.query("BEGIN");
    try {
      const actual = await cliente.query<{ es_sistema: boolean }>(
        `SELECT es_sistema FROM auth.perfiles WHERE id = $1`,
        [id],
      );
      if (!actual.rows[0]) throw new ErrorPerfil("El perfil no existe.");
      if (actual.rows[0].es_sistema) {
        throw new ErrorPerfil('El perfil "Administrador" es del sistema y no se puede editar.');
      }

      const duplicado = await cliente.query(
        `SELECT 1 FROM auth.perfiles WHERE lower(nombre) = lower($1) AND id <> $2`,
        [datos.nombre, id],
      );
      if (duplicado.rows.length) throw new ErrorPerfil(`Ya existe un perfil llamado "${datos.nombre}".`);

      await cliente.query(
        `UPDATE auth.perfiles SET nombre = $1, descripcion = $2, activo = $3, actualizado_en = now()
         WHERE id = $4`,
        [datos.nombre, datos.descripcion, datos.activo, id],
      );
      await reemplazarAsignaciones(cliente, id, datos);
      await cliente.query("COMMIT");
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      throw e;
    }
  });
}

export async function eliminarPerfil(id: string): Promise<void> {
  return conCliente(async (cliente) => {
    const fila = await cliente.query<{ es_sistema: boolean; nombre: string }>(
      `SELECT es_sistema, nombre FROM auth.perfiles WHERE id = $1`,
      [id],
    );
    if (!fila.rows[0]) throw new ErrorPerfil("El perfil no existe.");
    if (fila.rows[0].es_sistema) {
      throw new ErrorPerfil('El perfil "Administrador" es del sistema y no se puede eliminar.');
    }

    const usuarios = await contarUsuariosPorPerfil(id);
    if (usuarios > 0) {
      throw new ErrorPerfil(
        `No se puede eliminar "${fila.rows[0].nombre}": tiene ${usuarios} usuario(s) asignado(s). ` +
          "Reasígnalos a otro perfil primero.",
      );
    }

    await cliente.query(`DELETE FROM auth.perfiles WHERE id = $1`, [id]);
  });
}

function filaAPerfil(f: FilaPerfil): Perfil {
  return {
    id: f.id,
    nombre: f.nombre,
    descripcion: f.descripcion,
    activo: f.activo,
    esSistema: f.es_sistema,
    cantidadUsuarios: Number(f.cantidad_usuarios ?? 0),
  };
}
