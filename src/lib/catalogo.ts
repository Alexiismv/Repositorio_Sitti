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
  { slug: "experiencia-de-servicio", nombre: "Experiencia de Servicio", color: "#3FA9AC" },
  { slug: "operacion-contravencional", nombre: "Operación Contravencional", color: "#33357E" },
  { slug: "juridica", nombre: "Jurídica", color: "#F7A82C" },
  { slug: "financiera", nombre: "Financiera", color: "#EC623B" },
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
  { slug: "servicio", nombre: "Servicio", gerencia: "experiencia-de-servicio", volumen2026: 4632 },
  { slug: "aseguramiento-contravencional", nombre: "Aseguramiento Contravencional", gerencia: "operacion-contravencional", volumen2026: 2855 },
  { slug: "gestion-legal", nombre: "Gestión Legal", gerencia: "juridica", volumen2026: 1437 },
  // Corregido por Alexis (2 sep 2026): Radicación es de Jurídica, no de
  // Operación Contravencional (ver nota junto a "cad" y "digitalizacion" más
  // abajo — mismo error, misma corrección).
  { slug: "radicacion", nombre: "Radicación", gerencia: "juridica", volumen2026: 1114 },
  { slug: "cartera", nombre: "Cartera", gerencia: "financiera", volumen2026: 993 },
  { slug: "fotodeteccion", nombre: "Fotodetección", gerencia: "operacion-contravencional", volumen2026: 504 },
  { slug: "experiencia-de-servicio", nombre: "Experiencia de Servicio", gerencia: "experiencia-de-servicio", volumen2026: 398 },
  { slug: "financiera", nombre: "Financiera", gerencia: "financiera", volumen2026: 320 },
  { slug: "gestion-de-notificaciones", nombre: "Gestión de Notificaciones", gerencia: "experiencia-de-servicio", volumen2026: 252 },
  // Reclasificado por Alexis desde la raíz en Jira (25 ago 2026): ya no quedan
  // tickets reales en 2026 con Área = "Otras". Se conserva la fila (no se
  // borra) porque "Otras" sigue siendo una opción seleccionable en Jira — si
  // alguien la vuelve a elegir, el ETL necesita dónde aterrizarla.
  { slug: "otras", nombre: "Otras", gerencia: "sin-gerencia", volumen2026: 0 },
  { slug: "sin-nombre", nombre: "(Sin nombre — origen por identificar)", gerencia: "sin-gerencia", volumen2026: 140 },
  // Corregido por Alexis (2 sep 2026): CAD es de Jurídica, no de Operación
  // Contravencional — quedó mal clasificada junto con "radicacion" y
  // "digitalizacion" (mismo error en las tres).
  { slug: "cad", nombre: "CAD", gerencia: "juridica", volumen2026: 58 },
  { slug: "gestion-juridica-de-cobro", nombre: "Gestión Jurídica de Cobro", gerencia: "juridica", volumen2026: 55 },
  { slug: "conexion-de-soluciones", nombre: "Conexión de Soluciones", gerencia: "conexion-de-soluciones", volumen2026: 40 },
  { slug: "aseguramiento-contractual", nombre: "Aseguramiento Contractual", gerencia: "operacion-contravencional", volumen2026: 39 },
  { slug: "experiencia-y-bienestar", nombre: "Experiencia y Bienestar", gerencia: "experiencia-y-bienestar", volumen2026: 6 },
  { slug: "gerencia-general", nombre: "Gerencia General", gerencia: "sin-gerencia", volumen2026: 3 },
  // Confirmado por Alexis (25 ago 2026) que era de Operación Contravencional
  // y no de "sin gerencia" — y corregido de nuevo por Alexis (2 sep 2026):
  // en realidad es de Jurídica. Ver CLAUDE.md §2.1 para el detalle completo
  // de esta reclasificación (Radicación, CAD y Digitalización, las tres).
  { slug: "digitalizacion", nombre: "Digitalización", gerencia: "juridica", volumen2026: 1 },

  // Dependencias de "Mesa de ayuda SMM" (customfield_11698) — confirmado por
  // Alexis (25 ago 2026) que forman su propia gerencia, "SMM/ESU", y no
  // corresponden a ninguna de las 18 áreas de arriba (ver CLAUDE.md § 9 punto 2).
  { slug: "subsecretaria-seguridad-vial-control", nombre: "Subsecretaría de Seguridad Vial y Control", gerencia: "smm-esu", volumen2026: 3165 },
  { slug: "subsecretaria-legal", nombre: "Subsecretaría Legal", gerencia: "smm-esu", volumen2026: 101 },
  { slug: "esu", nombre: "ESU", gerencia: "smm-esu", volumen2026: 39 },
  { slug: "unidad-administrativa", nombre: "Unidad Administrativa", gerencia: "smm-esu", volumen2026: 19 },
  { slug: "despacho-legal", nombre: "Despacho Legal", gerencia: "smm-esu", volumen2026: 4 },
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

/**
 * ~16.170 tickets — la suma de las 24 áreas. Solo alimenta el generador demo
 * (`DEMO_MODE=true`); con datos reales el KPI general sale de la base.
 *
 * Reescalado por Alexis (4 sep 2026, factor ×1,4409 sobre los valores
 * originales) para que el mockup que ven las gerencias en producción tenga un
 * volumen similar al de los datos reales del momento — antes anclaba a
 * 11.223, un remanente de una foto más vieja del dataset real. Ver CLAUDE.md
 * §7.5 para el contexto completo de por qué producción corre en modo demo.
 */
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
    // Corrido más al oriente que la dirección literal a propósito: comparte
    // edificio con "Caribe" (ver dirección arriba), y con los pines a 72px
    // (4x) el offset anterior (-75.57055) dejaba los dos círculos
    // sobrepuestos — no se podía seleccionar uno sin clickear el otro.
    lon: -75.5537,
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
// PROYECTOS JSM (12 portales) — también el eje del módulo "Aplicativos"
// ─────────────────────────────────────────────────────────────
//
// Decisión de Alexis (7 sep 2026, Fase 1 del módulo Aplicativos): mientras no
// exista un campo propio en Jira para "aplicativo", ese módulo reutiliza este
// mismo catálogo de 12 proyectos JSM como su lista de "aplicativos" — por eso
// "Audiencias Web" (clave TAW) ya aparece acá. `src/app/(panel)/aplicativos/`
// filtra tickets con `obtenerTickets(sesion, { proyectos: [clave] })`, exactamente
// igual que cualquier otro filtro por proyecto.
//
// Fase 2 del EJE OPERATIVO (pendiente, cuando Alexis defina el nuevo
// JQL/custom field en Jira): si "aplicativo" termina siendo un eje de
// negocio distinto de "proyecto" para los TICKETS de operación (p. ej. una
// misma área usa varios aplicativos, o un aplicativo cruza varios
// proyectos), la migración es: (1) agregar `aplicativo`/`aplicativoSlug` a
// `Ticket` (`src/lib/demo/generador.ts` + `jira_cache.tickets_raw` +
// `normalizar()` en `src/lib/etl/jira.ts`, leyendo el custom field nuevo),
// (2) cambiar `porAplicativo()` (`src/lib/metricas.ts`) para agrupar por ese
// campo nuevo en vez de `proyectoClave`, y (3) sumar `aplicativos?: string[]`
// a `Filtros` (`src/lib/data/provider.ts`). Ninguna pantalla de
// `src/app/(panel)/aplicativos/` necesita tocarse — todas piden los datos a
// través de `porAplicativo()`/`obtenerTickets()`, igual que el resto de la app.
//
// El catálogo `APLICATIVOS` ya existe (más abajo) — se creó por otra razón
// (8 sep 2026, unificar proyectos operativos con Logística/MVI, que solo
// tienen backlog), no por esta Fase 2. El backlog de desarrollo (§ más
// abajo) YA está conectado de verdad desde el 8 sep 2026 — la Fase 2
// pendiente de acá es solo sobre el eje operativo (Tickets), no el backlog.

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
  /**
   * Color de acento — usado por el módulo "Aplicativos" (ver §11 más abajo).
   * No afecta al ETL ni al switch de Área; es puramente de presentación.
   */
  color: string;
  /**
   * `true` = no aparece como tarjeta en `/aplicativos` ni tiene detalle en
   * `/aplicativos/[slug]` (esa ruta devuelve 404). Decisión de Alexis (8 sep
   * 2026): GIC ya no se usa en la compañía y solo tiene 1 ticket en todo
   * 2026, así que no tiene sentido como aplicativo activo en ese módulo.
   * Solo afecta la interfaz de Aplicativos — el proyecto sigue existiendo
   * para todo lo demás (ETL, filtro "Aplicativo" de /reportes, Gerencias/Áreas).
   */
  ocultoEnAplicativos?: boolean;
  /**
   * Clave del proyecto JSM "* - Backlog" contraparte, confirmada por Alexis
   * (8 sep 2026) contra el Jira real. Si no está presente, el aplicativo no
   * tiene tablero de backlog — es el caso confirmado de Mesa de ayuda SITTI y
   * Mesa de ayuda SMM (conservan solo el tablero operativo tradicional) y de
   * Analítica/GIC (no tienen backlog propio). Fase 2 real: este campo es el
   * que alimenta el JQL nuevo (`project IN (BAWS, BGBACK, ...)`) cuando se
   * conecte el ETL — ver la nota junto a `CATEGORIAS_BACKLOG` más abajo.
   */
  claveBacklog?: string;
}

// Claves confirmadas por Alexis contra el Jira real (conexiondesoluciones.atlassian.net):
// solo los 12 proyectos "* - Tickets" (se excluyen a propósito sus contrapartes
// "* - Backlog", que son trabajo interno del equipo, no solicitudes de usuario).
export const PROYECTOS: Proyecto[] = [
  { clave: "TA", nombre: "Analítica", vocabulario: "estandar", campoArea: "customfield_10506", color: "#33357E" },
  { clave: "TAW", nombre: "Audiencias Web", vocabulario: "estandar", campoArea: "customfield_10506", color: "#3FA9AC", claveBacklog: "BAWS" },
  { clave: "TBACK", nombre: "BackOffice", vocabulario: "estandar", campoArea: "customfield_10506", color: "#F7A82C", claveBacklog: "BGBACK" },
  { clave: "TCOBRO", nombre: "Cobro Coactivo", vocabulario: "estandar", campoArea: "customfield_10506", color: "#EC623B", claveBacklog: "BCC" },
  { clave: "TDEI", nombre: "DEI", vocabulario: "estandar", campoArea: "customfield_10506", color: "#8B8FBF", claveBacklog: "BKDEI" },
  { clave: "TFRONT", nombre: "FrontOffice", vocabulario: "estandar", campoArea: "customfield_10506", color: "#6BBF59", claveBacklog: "BACKFRONT" },
  { clave: "TGA", nombre: "Gestión de la Atención", vocabulario: "estandar", campoArea: "customfield_10506", color: "#7A5AC4", claveBacklog: "BKGA" },
  { clave: "TGIC", nombre: "GIC", vocabulario: "estandar", campoArea: "customfield_10506", color: "#961E65", ocultoEnAplicativos: true },
  { clave: "TMULTAS", nombre: "Multas", vocabulario: "estandar", campoArea: "customfield_10506", color: "#B7BAD6", claveBacklog: "BKMULTAS" },
  { clave: "TQX", nombre: "Qx Tránsito", vocabulario: "estandar", campoArea: "customfield_10506", color: "#33357E", claveBacklog: "QXBK" },
  { clave: "TMA", nombre: "Mesa de ayuda SITTI", vocabulario: "mesa", campoArea: "customfield_10506", color: "#3FA9AC" },
  { clave: "REQ", nombre: "Mesa de ayuda SMM", vocabulario: "mesa", campoArea: "customfield_11698", sedeFija: "Caribe", color: "#F7A82C" },
];

/**
 * Aplicativos que SOLO tienen backlog de desarrollo — no tienen proyecto
 * "* - Tickets" propio en Jira, así que NO van en `PROYECTOS` (agregar ahí
 * una clave que no existe en Jira rompería el `project IN (...)` real del
 * ETL operativo). Confirmado por Alexis (8 sep 2026).
 *
 * Estuvieron ocultas del módulo Aplicativos entre el 8 sep (mismo día que se
 * agregaron) y el 8 sep (reactivadas) — Alexis las reactivó una vez
 * confirmado que su backlog real (proyectos LOGISTICA/BACKLOGMVI) también
 * quedó conectado en el ETL (`APLICATIVOS_CON_BACKLOG` en
 * `src/lib/etl/jira.ts`, que arma el JQL sobre `APLICATIVOS`, no sobre
 * `PROYECTOS` — así cubre también a estos dos).
 */
const APLICATIVOS_SOLO_BACKLOG: {
  clave: string;
  nombre: string;
  claveBacklog: string;
  color: string;
  ocultoEnAplicativos?: boolean;
}[] = [
  { clave: "logistica", nombre: "Logística", claveBacklog: "LOGISTICA", color: "#6BBF59" },
  { clave: "mvi", nombre: "MVI", claveBacklog: "BACKLOGMVI", color: "#B7BAD6" },
];

/**
 * Vista unificada del módulo Aplicativos — combina los proyectos operativos
 * (con su proyecto de backlog, si lo tiene) y los aplicativos que solo
 * existen como backlog. `src/app/(panel)/aplicativos/**` SIEMPRE recorre
 * esta lista, nunca `PROYECTOS` directo, para no dejar fuera a Logística/MVI
 * ni arriesgarse a que alguien agregue ahí una clave inventada.
 */
export interface Aplicativo {
  /** Identificador de ruta, siempre en minúsculas (`/aplicativos/{clave}`). */
  clave: string;
  nombre: string;
  color: string;
  /** Proyecto JSM operativo ("* - Tickets"), si lo tiene. */
  proyecto?: Proyecto;
  /** Clave del proyecto JSM de backlog ("* - Backlog"), si lo tiene. */
  claveBacklog?: string;
}

export const APLICATIVOS: Aplicativo[] = [
  ...PROYECTOS.filter((p) => !p.ocultoEnAplicativos).map(
    (p): Aplicativo => ({
      clave: p.clave.toLowerCase(),
      nombre: p.nombre,
      color: p.color,
      proyecto: p,
      claveBacklog: p.claveBacklog,
    }),
  ),
  ...APLICATIVOS_SOLO_BACKLOG.filter((a) => !a.ocultoEnAplicativos).map(
    (a): Aplicativo => ({ clave: a.clave, nombre: a.nombre, color: a.color, claveBacklog: a.claveBacklog }),
  ),
];

export const aplicativoPorClave = (clave: string) =>
  APLICATIVOS.find((a) => a.clave.toLowerCase() === clave.toLowerCase());

// ─────────────────────────────────────────────────────────────
// ESTADOS
// ─────────────────────────────────────────────────────────────

export type CategoriaEstado = "pendiente" | "en-progreso" | "esperando-terceros" | "resuelto" | "cancelado";

export const CATEGORIAS_ESTADO: { key: CategoriaEstado; label: string; color: string }[] = [
  { key: "pendiente", label: "Pendiente", color: "#EC623B" },
  { key: "en-progreso", label: "En progreso", color: "#33357E" },
  { key: "esperando-terceros", label: "En espera proveedor", color: "#F7A82C" },
  { key: "resuelto", label: "Resuelto", color: "#3FA9AC" },
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

// ─────────────────────────────────────────────────────────────
// BACKLOG DE DESARROLLO (tablero secundario del módulo Aplicativos)
// ─────────────────────────────────────────────────────────────
//
// Decisión de Alexis (7 sep 2026): cada aplicativo con proyecto de backlog
// (`Proyecto.claveBacklog`) tiene, además de su tablero operativo, un
// segundo tablero de backlog de desarrollo. Mesa de ayuda SITTI y Mesa de
// ayuda SMM NO tienen backlog — conservan solo el tablero operativo
// tradicional (confirmado por Alexis, 8 sep 2026).
//
// El JQL/proyectos reales (confirmados por Alexis, 8 sep 2026, contra Jira):
//   project IN (BAWS, BGBACK, BCC, BKDEI, BACKFRONT, BKGA, BKMULTAS, QXBK)
// — más LOGISTICA y BACKLOGMVI, que no tienen contraparte operativa en
// `PROYECTOS` (Logística/MVI, en `APLICATIVOS_SOLO_BACKLOG` más abajo, ocultas
// del módulo Aplicativos por decisión de Alexis: esos proyectos no reciben
// tickets de la operación).
//
// `ESTADO_A_CATEGORIA_BACKLOG` de abajo es el vocabulario REAL de Jira para
// esos proyectos, verificado el 8 sep 2026 contra 699 issues reales (solo
// lectura, sin escribir nada) — cobertura 100%.
//
// Fase 2 YA CONECTADA (8 sep 2026): el JQL/campos viven en
// `src/lib/etl/jira.ts` (`jqlBacklogCompleto`/`jqlBacklogIncremental`/
// `normalizarBacklog`), la sincronización real en
// `src/lib/etl/sincronizar.ts` (mismo botón "Refrescar" que los tickets
// operativos, misma transacción), las tablas en `db/schema.sql`
// (`jira_cache.backlog_raw`/`backlog_staging`/`v_backlog`), y
// `obtenerBacklog()` (`src/lib/data/provider.ts`) sigue a `DEMO_MODE` igual
// que `obtenerTickets()` — demo en local, real donde ya hay ETL corriendo.
export type CategoriaBacklog =
  | "gestion-ca"
  | "alcance-cotizacion"
  | "desarrollo-quipux"
  | "pruebas-sitti"
  | "pruebas-smm-esu"
  | "produccion-cancelado";

export const CATEGORIAS_BACKLOG: { key: CategoriaBacklog; label: string; color: string }[] = [
  { key: "gestion-ca", label: "Gestión de CA", color: "#EC623B" },
  { key: "alcance-cotizacion", label: "Alcance/Cotización", color: "#F7A82C" },
  { key: "desarrollo-quipux", label: "Desarrollo Quipux", color: "#33357E" },
  { key: "pruebas-sitti", label: "Pruebas Sitti-QA", color: "#7A5AC4" },
  { key: "pruebas-smm-esu", label: "Pruebas SMM/ESU", color: "#8B8FBF" },
  { key: "produccion-cancelado", label: "Producción/Cancelado", color: "#3FA9AC" },
];

/**
 * Vocabulario REAL de Jira, verificado el 8 sep 2026 contra los 8 proyectos
 * de backlog confirmados por Alexis (699 issues reales, vía
 * `POST /rest/api/3/search/jql` de solo lectura — no se escribió nada).
 *
 * Ojo con el guion final: la mayoría de los literales de Jira terminan en
 * " -" (ej. "GESTIONAR CA -", no "GESTIONAR CA") — es así en la instancia
 * real, no un error de tipeo. La única excepción real es "FINALIZADO", que
 * nunca lleva el guion. "CANCELADO" existe en Jira en las DOS formas (con y
 * sin guion, en proyectos distintos), así que ambas están mapeadas.
 *
 * A diferencia de `ESTADO_A_CATEGORIA` (un solo vocabulario para 10
 * proyectos + otro para las 2 mesas de ayuda), acá varios estados literales
 * distintos caen en la MISMA categoría a propósito: "PRUEBAS QA -" y
 * "ENTREGA QA - ADMIN -" son las dos caras de "Pruebas Sitti-QA", y
 * "CANCELADO"/"CANCELADO -"/"FINALIZADO"/"PRODUCCIÓN / SEGUIMIENTO -" son
 * las cuatro caras de "Producción/Cancelado" (mismo criterio que ya combina
 * Resuelto+Cancelado en el tablero operativo — ver CLAUDE.md §2.1.3, mismo
 * espíritu acá).
 */
export const ESTADO_A_CATEGORIA_BACKLOG: Record<string, CategoriaBacklog> = {
  "GESTIONAR CA -": "gestion-ca",
  "ALCANCE / COTIZACIÓN -": "alcance-cotizacion",
  "DESARROLLO QUIPUX -": "desarrollo-quipux",
  "PRUEBAS QA -": "pruebas-sitti",
  "ENTREGA QA - ADMIN -": "pruebas-sitti",
  "PRUEBAS SMM -": "pruebas-smm-esu",
  CANCELADO: "produccion-cancelado",
  "CANCELADO -": "produccion-cancelado",
  FINALIZADO: "produccion-cancelado",
  "PRODUCCIÓN / SEGUIMIENTO -": "produccion-cancelado",
};

export function categoriaDeEstadoBacklog(estado: string): CategoriaBacklog {
  return ESTADO_A_CATEGORIA_BACKLOG[estado] ?? "gestion-ca";
}

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

/**
 * Busca un proyecto por su clave, sin distinguir mayúsculas/minúsculas — el
 * módulo "Aplicativos" usa `clave.toLowerCase()` como slug de ruta
 * (`/aplicativos/taw`), así que hay que volver a subir el caso para comparar
 * contra `Ticket.proyectoClave` y `Filtros.proyectos`.
 */
export const proyectoPorClave = (clave: string) =>
  PROYECTOS.find((p) => p.clave.toLowerCase() === clave.toLowerCase());

/** Volumen 2026 de una gerencia = suma de sus áreas. Nunca hardcodeamos el total. */
export const volumenGerencia = (slug: string) =>
  areasDeGerencia(slug).reduce((acc, a) => acc + a.volumen2026, 0);

export function categoriaDeEstado(estado: string): CategoriaEstado {
  return ESTADO_A_CATEGORIA[estado] ?? "pendiente";
}
