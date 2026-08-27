/**
 * Catálogo de negocio de SITTI — fuente única de verdad de la app.
 *
 * Todo lo de aquí sale del documento de levantamiento de requisitos
 * (`docs/REQUISITOS.md`, secciones 4, 5 y 6) y está CONFIRMADO con Alexis.
 * En producción esto vive en el esquema `catalogo` de Postgres (ver `db/schema.sql`);
 * aquí queda tipado para que la UI y el generador demo compartan exactamente
 * los mismos nombres y no se desincronicen.
 */

// ─────────────────────────────────────────────────────────────
// GERENCIAS
// ─────────────────────────────────────────────────────────────

export type GerenciaSlug =
  | "experiencia-de-servicio"
  | "operacion-contravencional"
  | "juridica"
  | "financiera"
  | "conexion-de-soluciones"
  | "experiencia-y-bienestar"
  | "smm-esu"
  | "sin-gerencia";

export interface Gerencia {
  slug: GerenciaSlug;
  nombre: string;
  /** Color de acento — paleta de marca SITTI. */
  color: string;
}

export const GERENCIAS: Gerencia[] = [
  { slug: "experiencia-de-servicio", nombre: "Experiencia de Servicio", color: "#2FAFA0" },
  { slug: "operacion-contravencional", nombre: "Operación Contravencional", color: "#242868" },
  { slug: "juridica", nombre: "Jurídica", color: "#F6A623" },
  { slug: "financiera", nombre: "Financiera", color: "#F1592A" },
  { slug: "conexion-de-soluciones", nombre: "Conexión de Soluciones", color: "#8B8FBF" },
  { slug: "experiencia-y-bienestar", nombre: "Experiencia y Bienestar", color: "#6BBF59" },
  { slug: "smm-esu", nombre: "SMM/ESU", color: "#7A5AC4" },
  { slug: "sin-gerencia", nombre: "Sin gerencia asignada", color: "#B7BAD6" },
];

// ─────────────────────────────────────────────────────────────
// ÁREAS  (24 filas · volumen 2026 confirmado)
// ─────────────────────────────────────────────────────────────

export interface Area {
  slug: string;
  nombre: string;
  gerencia: GerenciaSlug;
  /** Volumen 2026 confirmado por Alexis — es el ancla del generador demo. */
  volumen2026: number;
}

export const AREAS: Area[] = [
  { slug: "servicio", nombre: "Servicio", gerencia: "experiencia-de-servicio", volumen2026: 3214 },
  { slug: "aseguramiento-contravencional", nombre: "Aseguramiento Contravencional", gerencia: "operacion-contravencional", volumen2026: 1981 },
  { slug: "gestion-legal", nombre: "Gestión Legal", gerencia: "juridica", volumen2026: 997 },
  { slug: "radicacion", nombre: "Radicación", gerencia: "operacion-contravencional", volumen2026: 773 },
  { slug: "cartera", nombre: "Cartera", gerencia: "financiera", volumen2026: 689 },
  { slug: "fotodeteccion", nombre: "Fotodetección", gerencia: "operacion-contravencional", volumen2026: 350 },
  { slug: "experiencia-de-servicio", nombre: "Experiencia de Servicio", gerencia: "experiencia-de-servicio", volumen2026: 276 },
  { slug: "financiera", nombre: "Financiera", gerencia: "financiera", volumen2026: 222 },
  { slug: "gestion-de-notificaciones", nombre: "Gestión de Notificaciones", gerencia: "experiencia-de-servicio", volumen2026: 175 },
  // Reclasificado por Alexis desde la raíz en Jira (25 ago 2026): ya no quedan
  // tickets reales en 2026 con Área = "Otras". Se conserva la fila (no se
  // borra) porque "Otras" sigue siendo una opción seleccionable en Jira — si
  // alguien la vuelve a elegir, el ETL necesita dónde aterrizarla.
  { slug: "otras", nombre: "Otras", gerencia: "sin-gerencia", volumen2026: 0 },
  { slug: "sin-nombre", nombre: "(Sin nombre — origen por identificar)", gerencia: "sin-gerencia", volumen2026: 97 },
  { slug: "cad", nombre: "CAD", gerencia: "operacion-contravencional", volumen2026: 40 },
  { slug: "gestion-juridica-de-cobro", nombre: "Gestión Jurídica de Cobro", gerencia: "juridica", volumen2026: 38 },
  { slug: "conexion-de-soluciones", nombre: "Conexión de Soluciones", gerencia: "conexion-de-soluciones", volumen2026: 28 },
  { slug: "aseguramiento-contractual", nombre: "Aseguramiento Contractual", gerencia: "operacion-contravencional", volumen2026: 27 },
  { slug: "experiencia-y-bienestar", nombre: "Experiencia y Bienestar", gerencia: "experiencia-y-bienestar", volumen2026: 4 },
  { slug: "gerencia-general", nombre: "Gerencia General", gerencia: "sin-gerencia", volumen2026: 2 },
  // Confirmado por Alexis (25 ago 2026): Digitalización pertenece a Operación
  // Contravencional, no a "sin gerencia".
  { slug: "digitalizacion", nombre: "Digitalización", gerencia: "operacion-contravencional", volumen2026: 1 },

  // Dependencias de "Mesa de ayuda SMM" (customfield_11698) — confirmado por
  // Alexis (25 ago 2026) que forman su propia gerencia, "SMM/ESU", y no
  // corresponden a ninguna de las 18 áreas de arriba (ver CLAUDE.md § 9 punto 2).
  { slug: "subsecretaria-seguridad-vial-control", nombre: "Subsecretaría de Seguridad Vial y Control", gerencia: "smm-esu", volumen2026: 2196 },
  { slug: "subsecretaria-legal", nombre: "Subsecretaría Legal", gerencia: "smm-esu", volumen2026: 70 },
  { slug: "esu", nombre: "ESU", gerencia: "smm-esu", volumen2026: 27 },
  { slug: "unidad-administrativa", nombre: "Unidad Administrativa", gerencia: "smm-esu", volumen2026: 13 },
  { slug: "despacho-legal", nombre: "Despacho Legal", gerencia: "smm-esu", volumen2026: 3 },
  // Sin tickets en 2026 todavía, pero es una opción seleccionable en Jira —
  // se conserva la fila para que el ETL sepa dónde aterrizarla si aparece.
  { slug: "subsecretaria-tecnica", nombre: "Subsecretaría Técnica", gerencia: "smm-esu", volumen2026: 0 },
];

/**
 * Nombres de área que llegan de Jira con un texto distinto al canónico del
 * catálogo, pero que el negocio confirmó que son la MISMA área. Hoy solo pasa
 * con "Gestión Juridica Documental" (sin tilde en "Juridica"), que Alexis
 * confirmó (25 ago 2026) que es "Gestión Jurídica de Cobro" con otro nombre
 * en Jira. `resolverArea()` en `src/lib/data/provider.ts` normaliza por acá
 * ANTES de buscar en `AREAS`.
 */
export const ALIAS_AREA: Record<string, string> = {
  "Gestión Juridica Documental": "Gestión Jurídica de Cobro",
};

/** 11.223 tickets — la suma de las 24 áreas. Solo alimenta el generador demo (`DEMO_MODE=true`); con datos reales el KPI general sale de la base. */
export const TOTAL_2026 = AREAS.reduce((acc, a) => acc + a.volumen2026, 0);

// ─────────────────────────────────────────────────────────────
// SEDES  (6 valores reales del campo customfield_10066)
// ─────────────────────────────────────────────────────────────

export interface Sede {
  slug: string;
  /** Debe coincidir LITERAL con el valor del campo `Sede` en Jira. */
  nombre: string;
  direccion: string;
  lat: number;
  lon: number;
  /**
   * `true` = el pin no corresponde a una dirección única.
   * Caso "Concesionarios": Jira agrupa varios puntos físicos bajo un solo valor,
   * así que se dibuja como un pin genérico y se marca en la UI.
   */
  aproximado?: boolean;
  /**
   * Dónde se dibuja la etiqueta respecto del pin.
   * Caribe y Centro de Servicios comparten dirección: sin esto sus etiquetas
   * se tapan una a la otra y no se lee ninguna de las dos.
   */
  etiqueta?: "derecha" | "izquierda" | "arriba" | "abajo";
  /** Peso relativo del tráfico de tickets — ancla del generador demo. */
  peso: number;
}

export const SEDES: Sede[] = [
  {
    slug: "caribe",
    nombre: "Caribe",
    direccion: "Cra 64C # 72-58, Barrio Caribe, Medellín",
    lat: 6.27096,
    etiqueta: "izquierda",
    lon: -75.57251,
    peso: 0.34,
  },
  {
    slug: "centro-de-servicios",
    nombre: "Centro de Servicios",
    direccion: "Cra 64C # 72-58, Barrio Caribe, Medellín (misma sede, operación distinta)",
    lat: 6.27245,
    etiqueta: "derecha",
    lon: -75.57055,
    peso: 0.26,
  },
  {
    slug: "premium-plaza-belen",
    nombre: "Premium Plaza - Belén",
    direccion: "CC Premium Plaza, Cra 43A # 30-25 · agrupa también el punto de Belén",
    lat: 6.22966,
    etiqueta: "derecha",
    lon: -75.57046,
    peso: 0.16,
  },
  {
    slug: "sao-paulo",
    nombre: "Sao Paulo",
    direccion: "Mall Sao Paulo, Cra 43A # 18S-135, La Frontera / El Poblado",
    lat: 6.18472,
    etiqueta: "derecha",
    lon: -75.57949,
    peso: 0.11,
  },
  {
    slug: "poblado",
    nombre: "Poblado",
    direccion: "Punto de atención El Poblado, Medellín",
    lat: 6.21035,
    etiqueta: "derecha",
    lon: -75.57097,
    peso: 0.08,
  },
  {
    slug: "concesionarios",
    nombre: "Concesionarios",
    direccion: "Varios puntos (concesionarios y centros comerciales) — Jira no distingue cuál",
    lat: 6.24215,
    etiqueta: "izquierda",
    lon: -75.59268,
    aproximado: true,
    peso: 0.05,
  },
];

// ─────────────────────────────────────────────────────────────
// PROYECTOS JSM (12 portales)
// ─────────────────────────────────────────────────────────────

export interface Proyecto {
  clave: string;
  nombre: string;
  /**
   * Vocabulario de estados que usa el proyecto. Los 10 "estándar" comparten uno;
   * las dos mesas de ayuda usan otro (ver sección 5 del doc de requisitos).
   */
  vocabulario: "estandar" | "mesa";
  /**
   * Excepción confirmada: "Mesa de ayuda SMM" NO usa customfield_10506 para Área,
   * usa customfield_11698 (Dependencia_SMM), y su sede es SIEMPRE "Caribe".
   */
  campoArea: "customfield_10506" | "customfield_11698";
  sedeFija?: string;
}

// Claves confirmadas por Alexis contra el Jira real (conexiondesoluciones.atlassian.net):
// solo los 12 proyectos "* - Tickets" (se excluyen a propósito sus contrapartes
// "* - Backlog", que son trabajo interno del equipo, no solicitudes de usuario).
export const PROYECTOS: Proyecto[] = [
  { clave: "TA", nombre: "Analítica", vocabulario: "estandar", campoArea: "customfield_10506" },
  { clave: "TAW", nombre: "Audiencias Web", vocabulario: "estandar", campoArea: "customfield_10506" },
  { clave: "TBACK", nombre: "BackOffice", vocabulario: "estandar", campoArea: "customfield_10506" },
  { clave: "TCOBRO", nombre: "Cobro Coactivo", vocabulario: "estandar", campoArea: "customfield_10506" },
  { clave: "TDEI", nombre: "DEI", vocabulario: "estandar", campoArea: "customfield_10506" },
  { clave: "TFRONT", nombre: "FrontOffice", vocabulario: "estandar", campoArea: "customfield_10506" },
  { clave: "TGA", nombre: "Gestión de la Atención", vocabulario: "estandar", campoArea: "customfield_10506" },
  { clave: "TGIC", nombre: "GIC", vocabulario: "estandar", campoArea: "customfield_10506" },
  { clave: "TMULTAS", nombre: "Multas", vocabulario: "estandar", campoArea: "customfield_10506" },
  { clave: "TQX", nombre: "Qx Tránsito", vocabulario: "estandar", campoArea: "customfield_10506" },
  { clave: "TMA", nombre: "Mesa de ayuda SITTI", vocabulario: "mesa", campoArea: "customfield_10506" },
  { clave: "REQ", nombre: "Mesa de ayuda SMM", vocabulario: "mesa", campoArea: "customfield_11698", sedeFija: "Caribe" },
];

// ─────────────────────────────────────────────────────────────
// ESTADOS
// ─────────────────────────────────────────────────────────────

export type CategoriaEstado = "pendiente" | "en-progreso" | "esperando-terceros" | "resuelto" | "cancelado";

export const CATEGORIAS_ESTADO: { key: CategoriaEstado; label: string; color: string }[] = [
  { key: "pendiente", label: "Pendiente", color: "#F1592A" },
  { key: "en-progreso", label: "En progreso", color: "#242868" },
  { key: "esperando-terceros", label: "Esperando terceros", color: "#F6A623" },
  { key: "resuelto", label: "Resuelto", color: "#2FAFA0" },
  { key: "cancelado", label: "Cancelado", color: "#9AA0B5" },
];

/**
 * Mapa estado literal de Jira -> categoría normalizada del tablero.
 * Conservamos SIEMPRE el texto literal en el detalle del ticket; la categoría
 * es solo para que el tablero se vea igual entre los dos vocabularios.
 */
export const ESTADO_A_CATEGORIA: Record<string, CategoriaEstado> = {
  // vocabulario "estándar" (10 proyectos)
  "EN ESPERA DE SOPORTE": "pendiente",
  "EN PROGRESO": "en-progreso",
  "SOLICITADO A QUIPUX": "esperando-terceros",
  "A LA ESPERA DE CLIENTE": "esperando-terceros",
  RESUELTO: "resuelto",
  CANCELADO: "cancelado",
  // vocabulario "mesa de ayuda" (SITTI y SMM)
  ABIERTO: "pendiente",
  "A LA ESPERA DEL PROVEEDOR": "esperando-terceros",
  "A LA ESPERA DE USUARIO": "esperando-terceros",
};

export const ESTADOS_POR_VOCABULARIO: Record<"estandar" | "mesa", string[]> = {
  estandar: [
    "EN ESPERA DE SOPORTE",
    "EN PROGRESO",
    "SOLICITADO A QUIPUX",
    "A LA ESPERA DE CLIENTE",
    "RESUELTO",
    "CANCELADO",
  ],
  mesa: [
    "ABIERTO",
    "A LA ESPERA DEL PROVEEDOR",
    "A LA ESPERA DE USUARIO",
    "EN PROGRESO",
    "CANCELADO",
    "RESUELTO",
  ],
};

// ─────────────────────────────────────────────────────────────
// SLA  (metas confirmadas — base del semáforo)
// ─────────────────────────────────────────────────────────────

export type Prioridad = "Alta" | "Media" | "Baja";

/** TTFR: 4 horas para TODOS los tickets, sin distinción de prioridad. */
export const META_TTFR_HORAS = 4;

/** TTR: depende de la prioridad del ticket (horas hábiles). */
export const META_TTR_HORAS: Record<Prioridad, number> = {
  Alta: 4,
  Media: 8,
  Baja: 24,
};

/** Umbral por defecto de "ticket estancado" (días sin actualización). Configurable en la UI. */
export const DIAS_ESTANCADO_DEFAULT = 5;

// ─────────────────────────────────────────────────────────────
// TIPOS DE REQUERIMIENTO (customfield_10010)
// ─────────────────────────────────────────────────────────────

export const TIPOS_REQUERIMIENTO = [
  "Solicitud de información",
  "Reporte de falla",
  "Solicitud de corrección",
  "Radicación de documento",
  "Acuerdo de pago",
  "Revisión de comparendo",
  "Solicitud de audiencia",
  "Habilitación de acceso",
];

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

export const gerenciaPorSlug = (slug: string) => GERENCIAS.find((g) => g.slug === slug);
export const areaPorSlug = (slug: string) => AREAS.find((a) => a.slug === slug);
export const sedePorSlug = (slug: string) => SEDES.find((s) => s.slug === slug);
export const areasDeGerencia = (slug: string) => AREAS.filter((a) => a.gerencia === slug);

/** Volumen 2026 de una gerencia = suma de sus áreas. Nunca hardcodeamos el total. */
export const volumenGerencia = (slug: string) =>
  areasDeGerencia(slug).reduce((acc, a) => acc + a.volumen2026, 0);

export function categoriaDeEstado(estado: string): CategoriaEstado {
  return ESTADO_A_CATEGORIA[estado] ?? "pendiente";
}
