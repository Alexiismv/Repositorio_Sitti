/**
 * Catálogo de pantallas, acciones y gráficos/widgets del sistema.
 *
 * Fuente única de verdad para el módulo "Gestión de perfiles" — mismo patrón
 * que `src/lib/catalogo.ts` para gerencias/áreas/sedes: se tipa acá y
 * `scripts/apply-schema.ts` lo siembra en Postgres (`auth.pantallas`,
 * `auth.acciones`, `auth.pantalla_accion`, `auth.widgets`) con
 * `ON CONFLICT DO UPDATE`, para que la app y la base nunca se desincronicen.
 *
 * Si agregas una pantalla nueva a `src/app/(panel)/**`, agrégala acá. El
 * perfil "Administrador" se re-siembra con acceso total a todo lo que haya en
 * este archivo cada vez que corre `npm run db:schema` — una pantalla nueva
 * queda cubierta sola, sin tocar SQL a mano.
 */

export interface Pantalla {
  slug: string;
  nombre: string;
  orden: number;
}

export const PANTALLAS: Pantalla[] = [
  { slug: "panel-general", nombre: "Panel General", orden: 1 },
  { slug: "gerencias", nombre: "Gerencias", orden: 2 },
  { slug: "areas", nombre: "Áreas", orden: 3 },
  { slug: "personas", nombre: "Personas", orden: 4 },
  { slug: "reportes", nombre: "Reportes", orden: 5 },
  { slug: "admin-usuarios", nombre: "Administración de usuarios", orden: 6 },
  { slug: "admin-perfiles", nombre: "Gestión de perfiles", orden: 7 },
];

export interface Accion {
  slug: string;
  nombre: string;
}

export const ACCIONES: Accion[] = [
  { slug: "ver", nombre: "Ver" },
  { slug: "crear", nombre: "Crear" },
  { slug: "editar", nombre: "Editar" },
  { slug: "eliminar", nombre: "Eliminar" },
  { slug: "exportar", nombre: "Exportar" },
  { slug: "restablecer_password", nombre: "Restablecer contraseña" },
  { slug: "sincronizar", nombre: "Sincronizar con Jira" },
];

/**
 * Qué acciones tienen sentido en cada pantalla — controla qué checkboxes de
 * acción aparecen en el sub-formulario de perfil (spec 3.3.3) al marcar esa
 * pantalla. No es un permiso: es el universo de opciones ofrecidas.
 */
export const PANTALLA_ACCION: Record<string, string[]> = {
  "panel-general": ["ver", "sincronizar"],
  gerencias: ["ver"],
  areas: ["ver"],
  personas: ["ver", "exportar"],
  reportes: ["ver", "exportar"],
  "admin-usuarios": ["ver", "crear", "editar", "restablecer_password"],
  "admin-perfiles": ["ver", "crear", "editar", "eliminar"],
};

export interface Widget {
  slug: string;
  pantalla: string;
  nombre: string;
  orden: number;
}

/**
 * Gráficos/indicadores de `src/components/charts.tsx`, agrupados por la
 * pantalla donde aparecen (spec 3.3.4: "si la pantalla tiene reportes o
 * dashboards con gráficos, listar cada uno con su propio checkbox").
 */
export const WIDGETS: Widget[] = [
  { slug: "mapa-sedes", pantalla: "panel-general", nombre: "Mapa por sede", orden: 1 },
  { slug: "creados-vs-resueltos", pantalla: "panel-general", nombre: "Creados vs. resueltos", orden: 2 },
  { slug: "grafica-semanal", pantalla: "panel-general", nombre: "Tendencia semanal", orden: 3 },
  { slug: "grafica-comparativa", pantalla: "reportes", nombre: "Comparativa por área/sede", orden: 1 },
  { slug: "ttr-vs-meta", pantalla: "reportes", nombre: "TTR vs. meta de SLA", orden: 2 },
];

export interface AccesoPerfil {
  pantallas: string[];
  /** pantalla_slug -> [accion_slug, ...] */
  acciones: Record<string, string[]>;
  widgets: string[];
}

/** Acceso total: todas las pantallas/acciones/widgets que haya en este archivo. */
export function accesoTotal(): AccesoPerfil {
  return {
    pantallas: PANTALLAS.map((p) => p.slug),
    acciones: { ...PANTALLA_ACCION },
    widgets: WIDGETS.map((w) => w.slug),
  };
}

const PANTALLAS_OPERATIVAS = ["panel-general", "gerencias", "areas", "reportes"];
const WIDGETS_OPERATIVOS = WIDGETS.map((w) => w.slug);

/**
 * Acceso "puente" que reproduce lo que daba el enum `rol` legado —
 * fuente única para sembrar los perfiles Gerente/Coordinador
 * (`scripts/apply-schema.ts`) y para las 3 cuentas demo en memoria
 * (`src/lib/auth/usuarios-demo.ts`), que no viven en Postgres y por lo
 * tanto no tienen perfiles reales que consultar.
 */
export const ACCESO_POR_ROL: Record<"gerente" | "coordinador", AccesoPerfil> = {
  gerente: {
    pantallas: PANTALLAS_OPERATIVAS,
    acciones: {
      "panel-general": ["ver", "sincronizar"],
      gerencias: ["ver"],
      areas: ["ver"],
      reportes: ["ver", "exportar"],
    },
    widgets: WIDGETS_OPERATIVOS,
  },
  coordinador: {
    pantallas: PANTALLAS_OPERATIVAS,
    acciones: {
      "panel-general": ["ver"],
      gerencias: ["ver"],
      areas: ["ver"],
      reportes: ["ver", "exportar"],
    },
    widgets: WIDGETS_OPERATIVOS,
  },
};

/** Acceso a la pantalla Personas — lo que antes daba el flag `ver_personas`. */
export const ACCESO_PERSONAS: AccesoPerfil = {
  pantallas: ["personas"],
  acciones: { personas: ["ver", "exportar"] },
  widgets: [],
};

/** Une varios `AccesoPerfil` en uno solo (pantallas/acciones/widgets sin duplicados). */
export function unirAccesos(...accesos: AccesoPerfil[]): AccesoPerfil {
  const pantallas = new Set<string>();
  const widgets = new Set<string>();
  const acciones: Record<string, Set<string>> = {};

  for (const acc of accesos) {
    for (const p of acc.pantallas) pantallas.add(p);
    for (const w of acc.widgets) widgets.add(w);
    for (const [pantalla, accs] of Object.entries(acc.acciones)) {
      const set = (acciones[pantalla] ??= new Set());
      for (const a of accs) set.add(a);
    }
  }

  return {
    pantallas: [...pantallas],
    widgets: [...widgets],
    acciones: Object.fromEntries(Object.entries(acciones).map(([p, s]) => [p, [...s]])),
  };
}
