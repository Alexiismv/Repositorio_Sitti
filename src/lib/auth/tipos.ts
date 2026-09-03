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
   * defecto, solo quien Alexis marque acá. El administrador la ve siempre.
   *
   * Este campo solo existe en `Usuario` (el modelo de las cuentas demo, ver
   * `usuarios-demo.ts`). Las cuentas reales lo reemplazaron por el perfil
   * auxiliar "Acceso a Personas" — ver `puedeVerPantalla(sesion, "personas")`.
   */
  verPersonas: boolean;
}

/**
 * Lo que viaja firmado dentro de la cookie de sesión. Nada sensible acá.
 *
 * Desde la Fase 4 de la migración a perfiles, `rol` YA NO viaja acá — la
 * autorización real (qué pantallas/acciones/gráficos ve este usuario) sale
 * de `pantallas`/`acciones`/`widgets`, calculados en el login como la UNIÓN
 * de todos los perfiles asignados (ver `construirSesion()` en
 * `src/lib/auth/construir-sesion.ts`). `permisos` (sede/área) sigue siendo
 * un eje aparte: decide qué DATOS ve, no qué pantallas.
 */
export interface Sesion {
  sub: string;
  email: string;
  nombre: string;
  permisos: Permiso[];
  /** Nombres de los perfiles asignados — solo para mostrar en el topbar. */
  perfiles: string[];
  /** Slugs de pantalla visibles (unión de todos los perfiles asignados). */
  pantallas: string[];
  /** pantalla_slug -> [accion_slug, ...] habilitadas para este usuario. */
  acciones: Record<string, string[]>;
  /** Slugs de gráficos/widgets visibles. */
  widgets: string[];
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

/**
 * ¿Ve todas las sedes/áreas sin recorte? Antes lo decidía el enum `rol`
 * (gerente/administrador = todo); ahora es puramente de datos: existe una
 * fila comodín `('*','*')` en `usuario_permiso`. Quien deba ver todo
 * necesita esa fila asignada explícitamente — `scripts/apply-schema.ts` la
 * sincroniza automáticamente para todo usuario cuyos perfiles asignados
 * incluyan "Administrador" o "Gerente" (ver `sincronizarComodinDeDatos` en
 * `src/lib/auth/usuarios-servicio.ts`), igual que ya hacía
 * `scripts/seed-demo.ts` para el administrador inicial.
 */
export function veTodo(sesion: Pick<Sesion, "permisos">): boolean {
  return sesion.permisos.some((p) => p.sede === "*" && p.area === "*");
}

/** ¿Esta pantalla está entre las que el perfil (o unión de perfiles) del usuario habilita? */
export function puedeVerPantalla(sesion: Pick<Sesion, "pantallas">, pantallaSlug: string): boolean {
  return sesion.pantallas.includes(pantallaSlug);
}

/** ¿Esta acción, dentro de esta pantalla, está habilitada para el usuario? */
export function puedeUsarAccion(
  sesion: Pick<Sesion, "acciones">,
  pantallaSlug: string,
  accionSlug: string,
): boolean {
  return sesion.acciones[pantallaSlug]?.includes(accionSlug) ?? false;
}

/** ¿Este gráfico/widget está habilitado para el usuario? */
export function puedeVerWidget(sesion: Pick<Sesion, "widgets">, widgetSlug: string): boolean {
  return sesion.widgets.includes(widgetSlug);
}

/**
 * ¿Este usuario puede ver esta combinación sede+área?
 * Se usa como filtro de datos (defense-in-depth: además del filtro de la UI,
 * el proveedor de datos vuelve a aplicarlo antes de devolver tickets).
 */
export function puedeVer(
  sesion: Pick<Sesion, "permisos">,
  sedeSlug: string,
  areaSlug: string,
): boolean {
  if (veTodo(sesion)) return true;
  return sesion.permisos.some(
    (p) => (p.sede === "*" || p.sede === sedeSlug) && (p.area === "*" || p.area === areaSlug),
  );
}
