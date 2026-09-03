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
