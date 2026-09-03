/**
 * Modelo de usuarios y permisos.
 *
 * Del doc de requisitos (sección 2), confirmado:
 * - Gerente ve TODO.
 * - Coordinador ve solo lo asignado, y la visibilidad de área está ANIDADA
 *   dentro de la sede: puede ver "Cartera" en Caribe y "Multas" en Poblado.
 *   Por eso el permiso es una tupla (sede, área), no dos listas independientes.
 * - Administrador gestiona usuarios (no hay autoregistro).
 */

export type Rol = "gerente" | "coordinador" | "administrador";

export const ROL_LABEL: Record<Rol, string> = {
  gerente: "Gerente",
  coordinador: "Coordinador",
  administrador: "Administrador",
};

/**
 * Una fila = "este usuario puede ver esta área dentro de esta sede".
 * `"*"` significa "todas". Espeja la tabla `auth.usuario_permiso`.
 */
export interface Permiso {
  /** slug de sede, o `"*"` para todas. */
  sede: string;
  /** slug de área, o `"*"` para todas las de esa sede. */
  area: string;
}

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  permisos: Permiso[];
  /**
   * Acceso a la pestaña Personas. Es un permiso explícito por usuario, no
   * derivado del rol ni del área: un gerente o coordinador no la ve por
   * defecto, solo quien Alexis marque acá. El administrador la ve siempre
   * (ver `puedeVerPersonas`).
   */
  verPersonas: boolean;
}

/** Lo que viaja firmado dentro de la cookie de sesión. Nada sensible acá. */
export interface Sesion {
  sub: string;
  email: string;
  nombre: string;
  rol: Rol;
  permisos: Permiso[];
  verPersonas: boolean;
}

/**
 * Perfil (rol) del módulo "Gestión de perfiles" — spec Alexis sep 2026.
 *
 * Reemplaza al catálogo estático de "Cargo": el campo Cargo del formulario de
 * usuario consume esta misma tabla (`auth.perfiles`) como dropdown dinámico.
 * Un usuario puede tener uno o varios perfiles asignados; sus permisos
 * efectivos son la UNIÓN de los permisos de todos sus perfiles.
 */
export interface Perfil {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  /** true solo para "Administrador": no editable ni eliminable desde la UI. */
  esSistema: boolean;
  /** Cuántos usuarios lo tienen asignado — para el listado (spec 3.2). */
  cantidadUsuarios?: number;
}

/** Detalle completo de un perfil: sus pantallas, acciones por pantalla y widgets. */
export interface PerfilDetalle extends Perfil {
  pantallas: string[];
  /** pantalla_slug -> [accion_slug, ...] */
  acciones: Record<string, string[]>;
  widgets: string[];
}

/** Iniciales para el avatar del topbar. */
export function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** El gerente y el administrador ven todo; el coordinador, solo lo asignado. */
export function veTodo(sesion: Pick<Sesion, "rol" | "permisos">): boolean {
  if (sesion.rol === "gerente" || sesion.rol === "administrador") return true;
  return sesion.permisos.some((p) => p.sede === "*" && p.area === "*");
}

/**
 * ¿Puede ver la pestaña Personas? El administrador siempre; cualquier otro
 * rol solo si tiene el permiso `verPersonas` asignado explícitamente.
 */
export function puedeVerPersonas(sesion: Pick<Sesion, "rol" | "verPersonas">): boolean {
  return sesion.rol === "administrador" || sesion.verPersonas === true;
}

/**
 * ¿Este usuario puede ver esta combinación sede+área?
 * Se usa como filtro de datos (defense-in-depth: además del filtro de la UI,
 * el proveedor de datos vuelve a aplicarlo antes de devolver tickets).
 */
export function puedeVer(
  sesion: Pick<Sesion, "rol" | "permisos">,
  sedeSlug: string,
  areaSlug: string,
): boolean {
  if (veTodo(sesion)) return true;
  return sesion.permisos.some(
    (p) => (p.sede === "*" || p.sede === sedeSlug) && (p.area === "*" || p.area === areaSlug),
  );
}
