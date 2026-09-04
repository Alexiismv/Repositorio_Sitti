import type { PoolClient } from "pg";

import { conCliente } from "@/lib/db";

import type { Permiso, Sesion } from "./tipos";

interface UsuarioBase {
  id: string;
  email: string;
  nombre: string;
}

/**
 * Arma la `Sesion` completa de un usuario ya autenticado: permisos de
 * sede/área (sin cambios) + la UNIÓN de pantallas/acciones/widgets de todos
 * los perfiles que tenga asignados (Fase 4 de la migración a perfiles).
 *
 * Compartido entre `api/auth/login/route.ts` (login normal) y
 * `api/auth/completar-cambio-obligatorio/route.ts` (login tras contraseña
 * por defecto) — las dos rutas que terminan en `crearSesion()` — para que no
 * haya dos copias de esta lógica pudiendo desincronizarse.
 */
export async function construirSesion(usuarioId: string): Promise<Sesion | null> {
  return conCliente(async (cliente) => {
    const filaUsuario = await cliente.query<UsuarioBase>(
      `SELECT id, email, nombre FROM auth.usuarios WHERE id = $1`,
      [usuarioId],
    );
    const usuario = filaUsuario.rows[0];
    if (!usuario) return null;

    const permisos = await cargarPermisos(cliente, usuarioId);
    const { perfiles, pantallas, acciones, widgets } = await cargarUnionDePerfiles(cliente, usuarioId);

    return {
      sub: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      permisos,
      perfiles,
      pantallas,
      acciones,
      widgets,
    };
  });
}

async function cargarPermisos(cliente: PoolClient, usuarioId: string): Promise<Permiso[]> {
  const r = await cliente.query<{ sede_slug: string; area_slug: string }>(
    `SELECT sede_slug, area_slug FROM auth.usuario_permiso WHERE usuario_id = $1`,
    [usuarioId],
  );
  return r.rows.map((p) => ({ sede: p.sede_slug, area: p.area_slug }));
}

async function cargarUnionDePerfiles(
  cliente: PoolClient,
  usuarioId: string,
): Promise<{
  perfiles: string[];
  pantallas: string[];
  acciones: Record<string, string[]>;
  widgets: string[];
}> {
  const perfilesRes = await cliente.query<{ id: string; nombre: string }>(
    `SELECT pf.id, pf.nombre
     FROM auth.usuario_perfil up
     JOIN auth.perfiles pf ON pf.id = up.perfil_id
     WHERE up.usuario_id = $1 AND pf.activo`,
    [usuarioId],
  );
  const perfilIds = perfilesRes.rows.map((p) => p.id);

  if (perfilIds.length === 0) {
    return { perfiles: [], pantallas: [], acciones: {}, widgets: [] };
  }

  const pantallasRes = await cliente.query<{ pantalla_slug: string }>(
    `SELECT DISTINCT pantalla_slug FROM auth.perfil_pantalla WHERE perfil_id = ANY($1::uuid[])`,
    [perfilIds],
  );
  const accionesRes = await cliente.query<{ pantalla_slug: string; accion_slug: string }>(
    `SELECT DISTINCT pantalla_slug, accion_slug FROM auth.perfil_pantalla_accion WHERE perfil_id = ANY($1::uuid[])`,
    [perfilIds],
  );
  const widgetsRes = await cliente.query<{ widget_slug: string }>(
    `SELECT DISTINCT widget_slug FROM auth.perfil_widget WHERE perfil_id = ANY($1::uuid[])`,
    [perfilIds],
  );

  const acciones: Record<string, string[]> = {};
  for (const fa of accionesRes.rows) {
    (acciones[fa.pantalla_slug] ??= []).push(fa.accion_slug);
  }

  return {
    perfiles: perfilesRes.rows.map((p) => p.nombre),
    pantallas: pantallasRes.rows.map((p) => p.pantalla_slug),
    acciones,
    widgets: widgetsRes.rows.map((w) => w.widget_slug),
  };
}
