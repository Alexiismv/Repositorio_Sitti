import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";

import { conCliente } from "@/lib/db";
import type { DatosUsuario } from "@/lib/validacion/usuario";

import type { Rol } from "./tipos";

export class ErrorUsuario extends Error {}

/** Password por defecto de todo usuario nuevo o restablecido — spec 1.3/2, decisión 6 del plan. */
const PASSWORD_POR_DEFECTO = "admin";
const COSTE_BCRYPT = 12;

export interface PerfilResumen {
  id: string;
  nombre: string;
}

export interface FilaUsuarioListado {
  id: string;
  nombre: string;
  apellidos: string | null;
  email: string;
  sedeSlug: string | null;
  sedeNombre: string | null;
  activo: boolean;
  cargoTexto: string;
  perfiles: PerfilResumen[];
}

export interface UsuarioDetalle {
  id: string;
  email: string;
  nombres: string;
  apellidos: string | null;
  tipoDocumento: string | null;
  numeroDocumento: string | null;
  sexo: string | null;
  celular: string | null;
  controlIp: boolean;
  sedeSlug: string | null;
  activo: boolean;
  tipoUsuario: string;
  perfiles: PerfilResumen[];
}

export type CampoOrden = "nombre" | "email" | "cargo";

export interface FiltrosUsuario {
  texto?: string;
  activo?: boolean;
  perfilId?: string;
  sedeSlug?: string;
  ordenPor?: CampoOrden;
  ordenDir?: "asc" | "desc";
  pagina?: number;
  tamanoPagina?: number;
}

export interface ResultadoListadoUsuarios {
  usuarios: FilaUsuarioListado[];
  total: number;
}

const ORDEN_SQL: Record<CampoOrden, string> = {
  nombre: "lower(u.nombre), lower(coalesce(u.apellidos, ''))",
  email: "lower(u.email)",
  cargo: "lower(coalesce(cargo.cargo_texto, '')) ",
};

export async function listarUsuarios(filtros: FiltrosUsuario = {}): Promise<ResultadoListadoUsuarios> {
  return conCliente(async (cliente) => {
    const condiciones: string[] = [];
    const valores: unknown[] = [];

    if (filtros.texto?.trim()) {
      const q = `%${filtros.texto.trim()}%`;
      valores.push(q);
      const i = valores.length;
      condiciones.push(
        `(u.nombre ILIKE $${i} OR u.apellidos ILIKE $${i} OR u.email ILIKE $${i} OR u.numero_documento ILIKE $${i})`,
      );
    }
    if (filtros.activo !== undefined) {
      valores.push(filtros.activo);
      condiciones.push(`u.activo = $${valores.length}`);
    }
    if (filtros.sedeSlug) {
      valores.push(filtros.sedeSlug);
      condiciones.push(`u.sede_slug = $${valores.length}`);
    }
    if (filtros.perfilId) {
      valores.push(filtros.perfilId);
      condiciones.push(
        `EXISTS (SELECT 1 FROM auth.usuario_perfil up WHERE up.usuario_id = u.id AND up.perfil_id = $${valores.length})`,
      );
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
    const ordenPor = filtros.ordenPor ?? "nombre";
    const ordenDir = filtros.ordenDir === "desc" ? "DESC" : "ASC";
    const tamanoPagina = Math.min(Math.max(filtros.tamanoPagina ?? 10, 1), 100);
    const pagina = Math.max(filtros.pagina ?? 1, 1);
    const offset = (pagina - 1) * tamanoPagina;

    valores.push(tamanoPagina, offset);

    const r = await cliente.query<{
      id: string;
      nombre: string;
      apellidos: string | null;
      email: string;
      sede_slug: string | null;
      sede_nombre: string | null;
      activo: boolean;
      cargo_texto: string | null;
      total: string;
    }>(
      `SELECT u.id, u.nombre, u.apellidos, u.email, u.sede_slug, s.nombre AS sede_nombre, u.activo,
              cargo.cargo_texto,
              COUNT(*) OVER() AS total
       FROM auth.usuarios u
       LEFT JOIN catalogo.sedes s ON s.slug = u.sede_slug
       LEFT JOIN LATERAL (
         SELECT string_agg(pf.nombre, ', ' ORDER BY pf.nombre) AS cargo_texto
         FROM auth.usuario_perfil up
         JOIN auth.perfiles pf ON pf.id = up.perfil_id
         WHERE up.usuario_id = u.id
       ) cargo ON true
       ${where}
       ORDER BY ${ORDEN_SQL[ordenPor]} ${ordenDir}
       LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
      valores,
    );

    const ids = r.rows.map((f) => f.id);
    const perfilesPorUsuario = await cargarPerfilesDeUsuarios(cliente, ids);

    return {
      total: Number(r.rows[0]?.total ?? 0),
      usuarios: r.rows.map((f) => ({
        id: f.id,
        nombre: f.nombre,
        apellidos: f.apellidos,
        email: f.email,
        sedeSlug: f.sede_slug,
        sedeNombre: f.sede_nombre,
        activo: f.activo,
        cargoTexto: f.cargo_texto ?? "Sin perfil asignado",
        perfiles: perfilesPorUsuario.get(f.id) ?? [],
      })),
    };
  });
}

async function cargarPerfilesDeUsuarios(
  cliente: PoolClient,
  usuarioIds: string[],
): Promise<Map<string, PerfilResumen[]>> {
  const mapa = new Map<string, PerfilResumen[]>();
  if (usuarioIds.length === 0) return mapa;

  const r = await cliente.query<{ usuario_id: string; id: string; nombre: string }>(
    `SELECT up.usuario_id, pf.id, pf.nombre
     FROM auth.usuario_perfil up
     JOIN auth.perfiles pf ON pf.id = up.perfil_id
     WHERE up.usuario_id = ANY($1::uuid[])
     ORDER BY pf.nombre`,
    [usuarioIds],
  );
  for (const fila of r.rows) {
    const lista = mapa.get(fila.usuario_id) ?? [];
    lista.push({ id: fila.id, nombre: fila.nombre });
    mapa.set(fila.usuario_id, lista);
  }
  return mapa;
}

export async function obtenerUsuario(id: string): Promise<UsuarioDetalle | null> {
  return conCliente(async (cliente) => {
    const r = await cliente.query<{
      id: string;
      email: string;
      nombre: string;
      apellidos: string | null;
      tipo_documento: string | null;
      numero_documento: string | null;
      sexo: string | null;
      celular: string | null;
      control_ip: boolean;
      sede_slug: string | null;
      activo: boolean;
      tipo_usuario: string;
    }>(
      `SELECT id, email, nombre, apellidos, tipo_documento, numero_documento, sexo, celular,
              control_ip, sede_slug, activo, tipo_usuario
       FROM auth.usuarios WHERE id = $1`,
      [id],
    );
    const fila = r.rows[0];
    if (!fila) return null;

    const perfilesPorUsuario = await cargarPerfilesDeUsuarios(cliente, [id]);

    return {
      id: fila.id,
      email: fila.email,
      nombres: fila.nombre,
      apellidos: fila.apellidos,
      tipoDocumento: fila.tipo_documento,
      numeroDocumento: fila.numero_documento,
      sexo: fila.sexo,
      celular: fila.celular,
      controlIp: fila.control_ip,
      sedeSlug: fila.sede_slug,
      activo: fila.activo,
      tipoUsuario: fila.tipo_usuario,
      perfiles: perfilesPorUsuario.get(id) ?? [],
    };
  });
}

/**
 * Deriva el `rol` legado (gerente/coordinador/administrador) a partir de los
 * perfiles asignados, mientras `auth.usuarios.rol` siga siendo `NOT NULL` y
 * sea lo que de verdad usan `middleware`/`topbar`/gates de autorización — eso
 * cambia recién en la Fase 4 de la migración (ver plan). Puente deliberado:
 * los 3 perfiles "puente" sembrados en Fase 1 (Administrador/Gerente/
 * Coordinador) mapean 1:1 al `rol` que reemplazan; cualquier perfil nuevo que
 * no sea ninguno de esos tres no amplía privilegios legados — el usuario
 * queda con el `rol` menos privilegiado hasta que Fase 4 borre esta muleta.
 */
function rolDesdePerfiles(nombresPerfiles: string[]): Rol {
  if (nombresPerfiles.includes("Administrador")) return "administrador";
  if (nombresPerfiles.includes("Gerente")) return "gerente";
  return "coordinador";
}

async function sincronizarRolConPerfiles(
  cliente: PoolClient,
  usuarioId: string,
  sedeSlug: string | null,
): Promise<void> {
  const r = await cliente.query<{ nombre: string }>(
    `SELECT pf.nombre FROM auth.usuario_perfil up JOIN auth.perfiles pf ON pf.id = up.perfil_id
     WHERE up.usuario_id = $1`,
    [usuarioId],
  );
  const rol = rolDesdePerfiles(r.rows.map((f) => f.nombre));
  await cliente.query(`UPDATE auth.usuarios SET rol = $1 WHERE id = $2`, [rol, usuarioId]);

  /*
   * `veTodo()` (src/lib/auth/tipos.ts) ya no mira `rol`: solo mira si existe
   * una fila comodín `('*','*')` en `usuario_permiso`. Antes ese alcance
   * total salía gratis con `rol IN ('gerente','administrador')` — para que
   * asignarle el perfil Administrador o Gerente a alguien desde este CRUD
   * siga dándole visibilidad total de datos (y no solo de pantallas), se
   * mantiene la fila comodín sincronizada acá. Deliberadamente NO se borra
   * si el rol baja a coordinador: quitar acceso a datos no es un efecto
   * secundario esperado de un cambio de perfil, y podría pisar permisos de
   * sede/área configurados a mano.
   */
  if (rol === "administrador" || rol === "gerente") {
    await cliente.query(
      `INSERT INTO auth.usuario_permiso (usuario_id, sede_slug, area_slug) VALUES ($1, '*', '*')
       ON CONFLICT DO NOTHING`,
      [usuarioId],
    );
  }

  /*
   * Coordinador: el formulario de usuario solo ofrece UNA sede (todas sus
   * áreas, no un subconjunto), así que ese es el único permiso de datos que
   * puede salir de acá — se guarda como (sede, '*'). Sin este bloque, un
   * coordinador recién creado se queda con `usuario_permiso` vacío: entra
   * bien (sus pantallas/acciones sí salen de los perfiles), pero
   * `puedeVer()` le niega cada ticket y todo el panel se ve en cero — bug
   * confirmado el 4 sep 2026 (Katherine Martínez Cano). Se reemplaza
   * cualquier fila de sede puntual (no la comodín) por la sede actual en
   * cada guardado, para que un cambio de sede en el formulario mueva
   * también el permiso. Si más adelante se agrega una pantalla de permisos
   * más fina (áreas puntuales dentro de la sede), esta función deja de ser
   * la única fuente de verdad y hay que revisarla.
   */
  if (rol === "coordinador") {
    await cliente.query(`DELETE FROM auth.usuario_permiso WHERE usuario_id = $1 AND sede_slug <> '*'`, [
      usuarioId,
    ]);
    if (sedeSlug) {
      await cliente.query(
        `INSERT INTO auth.usuario_permiso (usuario_id, sede_slug, area_slug) VALUES ($1, $2, '*')
         ON CONFLICT DO NOTHING`,
        [usuarioId, sedeSlug],
      );
    }
  }
}

async function reemplazarPerfilesDeUsuario(
  cliente: PoolClient,
  usuarioId: string,
  perfilIds: string[],
  sedeSlug: string | null,
): Promise<void> {
  await cliente.query(`DELETE FROM auth.usuario_perfil WHERE usuario_id = $1`, [usuarioId]);
  for (const perfilId of perfilIds) {
    await cliente.query(
      `INSERT INTO auth.usuario_perfil (usuario_id, perfil_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [usuarioId, perfilId],
    );
  }
  await sincronizarRolConPerfiles(cliente, usuarioId, sedeSlug);
}

/** Todo usuario nuevo nace con la contraseña por defecto y debe cambiarla al primer login (decisión 6 del plan). */
export async function crearUsuario(datos: DatosUsuario): Promise<string> {
  return conCliente(async (cliente) => {
    await cliente.query("BEGIN");
    try {
      const existe = await cliente.query(`SELECT 1 FROM auth.usuarios WHERE lower(email) = lower($1)`, [
        datos.email,
      ]);
      if (existe.rows.length) throw new ErrorUsuario(`Ya existe un usuario con el correo "${datos.email}".`);

      const hash = await bcrypt.hash(PASSWORD_POR_DEFECTO, COSTE_BCRYPT);
      const rolInicial = rolDesdePerfiles([]); // se recalcula abajo tras asignar perfiles

      const r = await cliente.query<{ id: string }>(
        `INSERT INTO auth.usuarios
           (email, nombre, apellidos, password_hash, rol, activo, tipo_documento, numero_documento,
            sexo, celular, control_ip, tipo_usuario, sede_slug, debe_cambiar_password)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true)
         RETURNING id`,
        [
          datos.email,
          datos.nombres,
          datos.apellidos,
          hash,
          rolInicial,
          datos.activo,
          datos.tipoDocumento,
          datos.numeroDocumento,
          datos.sexo,
          datos.celular,
          datos.controlIp,
          datos.tipoUsuario,
          datos.sedeSlug,
        ],
      );
      const id = r.rows[0].id;
      await reemplazarPerfilesDeUsuario(cliente, id, datos.perfiles, datos.sedeSlug);
      await cliente.query("COMMIT");
      return id;
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      throw e;
    }
  });
}

export async function actualizarUsuario(id: string, datos: DatosUsuario): Promise<void> {
  return conCliente(async (cliente) => {
    await cliente.query("BEGIN");
    try {
      const actual = await cliente.query(`SELECT 1 FROM auth.usuarios WHERE id = $1`, [id]);
      if (!actual.rows[0]) throw new ErrorUsuario("El usuario no existe.");

      const duplicado = await cliente.query(
        `SELECT 1 FROM auth.usuarios WHERE lower(email) = lower($1) AND id <> $2`,
        [datos.email, id],
      );
      if (duplicado.rows.length) throw new ErrorUsuario(`Ya existe un usuario con el correo "${datos.email}".`);

      await cliente.query(
        `UPDATE auth.usuarios
         SET email = $1, nombre = $2, apellidos = $3, activo = $4, tipo_documento = $5,
             numero_documento = $6, sexo = $7, celular = $8, control_ip = $9, tipo_usuario = $10,
             sede_slug = $11, actualizado_en = now()
         WHERE id = $12`,
        [
          datos.email,
          datos.nombres,
          datos.apellidos,
          datos.activo,
          datos.tipoDocumento,
          datos.numeroDocumento,
          datos.sexo,
          datos.celular,
          datos.controlIp,
          datos.tipoUsuario,
          datos.sedeSlug,
          id,
        ],
      );
      await reemplazarPerfilesDeUsuario(cliente, id, datos.perfiles, datos.sedeSlug);
      await cliente.query("COMMIT");
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      throw e;
    }
  });
}

/** Reemplaza el conjunto de perfiles asignados — usado por el enlace "Perfil" de la tabla (spec 1.2). */
export async function asignarPerfiles(usuarioId: string, perfilIds: string[]): Promise<void> {
  return conCliente(async (cliente) => {
    await cliente.query("BEGIN");
    try {
      const existe = await cliente.query<{ sede_slug: string | null }>(
        `SELECT sede_slug FROM auth.usuarios WHERE id = $1`,
        [usuarioId],
      );
      if (!existe.rows[0]) throw new ErrorUsuario("El usuario no existe.");

      // Este atajo no toca la sede: se lee la ya guardada para que
      // sincronizarRolConPerfiles() pueda armar el permiso de Coordinador
      // igual que en crearUsuario/actualizarUsuario.
      await reemplazarPerfilesDeUsuario(cliente, usuarioId, perfilIds, existe.rows[0].sede_slug);
      await cliente.query("COMMIT");
    } catch (e) {
      await cliente.query("ROLLBACK").catch(() => {});
      throw e;
    }
  });
}
