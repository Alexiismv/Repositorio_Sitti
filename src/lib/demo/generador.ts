/**
 * Generador de datos DEMO.
 *
 * Por qué existe: la app todavía no está conectada a Jira ni a Postgres, pero
 * queremos que TODAS las pantallas muestren números que cuadren entre sí
 * (el total del panel general = la suma de gerencias = la suma de áreas = lo que
 * sale al filtrar por sede). Un `Math.random()` suelto por pantalla haría que
 * cada vista contara una historia distinta y la demo perdería credibilidad.
 *
 * Cómo lo resuelve: se genera UNA sola vez un dataset completo de tickets,
 * con PRNG semillado (determinístico: misma semilla -> mismo dataset, siempre),
 * anclado a los volúmenes 2026 confirmados por área. Todas las métricas se
 * calculan agregando ese dataset — exactamente como después se harán con SQL.
 *
 * Cuando Alexis conecte Jira + Postgres, esto se apaga con `DEMO_MODE=false`
 * y el proveedor de datos (`src/lib/data/provider.ts`) lee de la base.
 * La forma del ticket es la misma que la tabla `jira_cache.tickets_raw`.
 */

import {
  AREAS,
  ESTADOS_POR_VOCABULARIO,
  META_TTFR_HORAS,
  META_TTR_HORAS,
  PROYECTOS,
  SEDES,
  TIPOS_REQUERIMIENTO,
  categoriaDeEstado,
  type CategoriaEstado,
  type Prioridad,
} from "@/lib/catalogo";
import { DEMO_MODE } from "@/lib/modo";

// ─────────────────────────────────────────────────────────────
// Fecha de corte del snapshot demo
// ─────────────────────────────────────────────────────────────

/**
 * El dataset demo es una FOTO, no un stream en vivo. Todo lo relativo
 * ("hace X días", "estancado") se calcula contra esta fecha, no contra
 * `Date.now()`. Eso evita dos problemas: que el servidor y el cliente
 * calculen distinto (hydration mismatch) y que la demo cambie sola cada día.
 *
 * OJO: esta constante ancla SOLO al dataset demo. Para preguntar "¿hasta
 * cuándo llegan los datos?" se usa `fechaCorte()`, acá abajo.
 */
export const FECHA_CORTE = new Date("2026-08-20T18:00:00.000Z");
export const ANIO_DEMO = 2026;

/**
 * Hasta dónde llega la información que muestra el panel.
 *
 * Con datos reales es AHORA: las ventanas de "últimos N días/semanas" tienen
 * que terminar en el día de hoy. Antes, todas las métricas por tiempo se
 * calculaban contra `FECHA_CORTE` sin importar el modo, así que el panel se
 * quedó congelado en el 20 de agosto y dejó de mostrar los tickets nuevos
 * aunque el ETL los estuviera trayendo bien.
 *
 * En modo demo se conserva la fecha fija, que es lo que hace que la foto no
 * cambie sola cada día.
 *
 * Se llama por render y no se cachea en un módulo a propósito: un `new Date()`
 * a nivel de módulo se congelaría en el arranque del servidor, que es el mismo
 * bug con otra cara. Todo esto corre en el servidor (las gráficas reciben los
 * datos ya calculados por props), así que no hay riesgo de hydration mismatch.
 */
export function fechaCorte(): Date {
  return DEMO_MODE ? FECHA_CORTE : new Date();
}

/** Meses ya transcurridos en 2026 a la fecha de corte (Ene..Ago = 8). */
const MESES_TRANSCURRIDOS = 8;

// ─────────────────────────────────────────────────────────────
// PRNG determinístico (mulberry32)
// ─────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rng(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash estable de string -> entero, para semillar por área. */
function hashSemilla(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type Rng = () => number;

function elegirPonderado<T>(rng: Rng, items: T[], pesos: number[]): T {
  const total = pesos.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= pesos[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function enteroEntre(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// ─────────────────────────────────────────────────────────────
// Personas (asignados) — nombres ficticios, solo para la demo
// ─────────────────────────────────────────────────────────────

const NOMBRES = [
  "Ana Restrepo", "Carlos Múnera", "Diana Ospina", "Julián Zapata", "Laura Cardona",
  "Andrés Betancur", "Paola Gaviria", "Sebastián Arango", "Natalia Vélez", "Mateo Higuita",
  "Camila Jaramillo", "Felipe Mesa", "Valentina Ríos", "Santiago Uribe", "Daniela Correa",
  "Juan Pablo Ceballos", "Marcela Agudelo", "Esteban Quintero", "Sara Montoya", "Nicolás Duque",
  "Isabella Londoño", "David Salazar", "Manuela Toro", "Alejandro Pineda", "Sofía Bedoya",
  "Ricardo Álvarez", "Carolina Franco", "Miguel Ángel Roldán", "Luisa Henao", "Óscar Palacio",
  "Adriana Marín", "Tomás Escobar", "Verónica Grisales", "Iván Castaño", "Melissa Ocampo",
  "Jorge Ramírez", "Claudia Serna", "Emilio Vargas", "Tatiana Muñoz", "Federico Yepes",
];

/** Cada área tiene su propio equipo (3-6 personas), estable entre corridas. */
function equipoDeArea(areaSlug: string): string[] {
  const rng = mulberry32(hashSemilla(`equipo:${areaSlug}`));
  const tam = enteroEntre(rng, 3, 6);
  const disponibles = [...NOMBRES];
  const equipo: string[] = [];
  for (let i = 0; i < tam; i++) {
    const idx = Math.floor(rng() * disponibles.length);
    equipo.push(disponibles.splice(idx, 1)[0]);
  }
  return equipo;
}

// ─────────────────────────────────────────────────────────────
// Qué proyectos JSM alimentan cada área
// ─────────────────────────────────────────────────────────────

const PROYECTOS_POR_AREA: Record<string, string[]> = {
  servicio: ["TFRONT", "TGA", "TMA", "REQ"],
  "aseguramiento-contravencional": ["TQX", "TMULTAS", "REQ"],
  "gestion-legal": ["TAW", "TCOBRO", "TQX"],
  radicacion: ["TBACK", "TGA"],
  cartera: ["TCOBRO", "TBACK"],
  fotodeteccion: ["TMULTAS", "TQX"],
  "experiencia-de-servicio": ["TFRONT", "TGA"],
  financiera: ["TCOBRO", "TBACK"],
  "gestion-de-notificaciones": ["TGA", "TBACK"],
  otras: ["TMA", "TDEI"],
  "sin-nombre": ["TMA", "REQ"],
  cad: ["TQX", "TGIC"],
  "gestion-juridica-de-cobro": ["TCOBRO", "TAW"],
  "conexion-de-soluciones": ["TA", "TGIC"],
  "aseguramiento-contractual": ["TBACK", "TGIC"],
  "experiencia-y-bienestar": ["TMA"],
  "gerencia-general": ["TMA"],
  digitalizacion: ["TDEI"],
};

/** Estacionalidad Ene..Ago — la operación crece en el año. Ago va parcial (corte el 20). */
const PESO_MES = [0.72, 0.80, 0.88, 0.79, 1.0, 1.08, 1.18, 0.72];

const TIPOS_INCIDENCIA = ["Solicitud de servicio", "Incidente", "Petición de información", "Cambio"];

const PLANTILLAS_TITULO = [
  "Revisión de comparendo {n}",
  "Solicitud de certificado de {t}",
  "Falla en el módulo de {t}",
  "Radicación de documento {n}",
  "Actualización de datos del ciudadano {n}",
  "Solicitud de acuerdo de pago {n}",
  "Consulta de estado del proceso {n}",
  "Corrección de registro {n}",
  "Habilitación de acceso para funcionario {n}",
  "Reporte de inconsistencia en {t}",
];

// ─────────────────────────────────────────────────────────────
// Tipo de ticket (espeja jira_cache.tickets_raw)
// ─────────────────────────────────────────────────────────────

export interface Ticket {
  clave: string;
  tituloTicket: string;
  proyecto: string;
  proyectoClave: string;
  fechaCreacion: string; // ISO
  fechaCierre: string | null; // ISO
  fechaActualizacion: string; // ISO
  personaAsignada: string;
  /** Quien creó el ticket (el ciudadano/cliente), no quien lo resuelve. */
  informador: string;
  estadoTicket: string; // literal de Jira
  categoriaEstado: CategoriaEstado; // normalizado para el tablero
  prioridad: Prioridad;
  tipoIncidencia: string;
  tipoRequerimiento: string;
  sede: string;
  area: string; // nombre del área (ya resuelto el switch SMM)
  areaSlug: string;
  gerenciaSlug: string;
  /**
   * Horas hasta la primera respuesta (customfield_10044). `null` cuando la
   * métrica TTFR no estaba activa en Jira al momento de crear el ticket
   * (se activó ~jun 2026 — ver CLAUDE.md § 9).
   */
  ttfrHoras: number | null;
  /** Horas hábiles hasta la resolución (customfield_10043). `null` si sigue abierto. */
  ttrHoras: number | null;
  ttfrIncumplido: boolean;
  ttrIncumplido: boolean;
  comentarios: number;
  /** Días sin actualización a la fecha de corte. */
  diasSinActualizar: number;
}

// ─────────────────────────────────────────────────────────────
// Generación
// ─────────────────────────────────────────────────────────────

/**
 * Probabilidad de que un ticket cerrado cumpla su meta de TTR (`rng() < p`).
 * Antes era 0.72 fijo para las tres prioridades, lo que —por la forma de la
 * distribución de abajo— hacía que el PROMEDIO de TTR quedara siempre ~34%
 * por encima de la meta sin importar la prioridad, así que el semáforo de
 * "Tiempo final de resolución" salía en rojo para Alta, Media y Baja por
 * igual. Ajustado por prioridad (6 sep 2026, mockup a gerencias en
 * Production — CLAUDE.md §7.5) para que el cumplimiento AGREGADO (todas las
 * prioridades juntas, `resumen().cumplimientoTtr`) supere el 90% que pinta
 * en verde la cajita "Tiempo final de resolución" del panel general. Alta
 * queda apenas por debajo de su propia meta en promedio (~4,2h vs. 4h) para
 * que siga viéndose como la más exigente de cumplir; Media y Baja quedan
 * cómodamente dentro de meta (~5,9h y ~14,3h).
 */
const PROBABILIDAD_CUMPLE_TTR: Record<Prioridad, number> = {
  Alta: 0.82,
  Media: 0.92,
  Baja: 0.96,
};

function generarTicketsDeArea(area: (typeof AREAS)[number]): Ticket[] {
  const rng = mulberry32(hashSemilla(`area:${area.slug}`));
  const equipo = equipoDeArea(area.slug);
  const clavesProyecto = PROYECTOS_POR_AREA[area.slug] ?? ["TMA"];
  const proyectos = clavesProyecto
    .map((c) => PROYECTOS.find((p) => p.clave === c))
    .filter((p): p is (typeof PROYECTOS)[number] => Boolean(p));

  const tickets: Ticket[] = [];

  for (let i = 0; i < area.volumen2026; i++) {
    const proyecto = elegirPonderado(
      rng,
      proyectos,
      proyectos.map((_, idx) => (idx === 0 ? 3 : 1)),
    );

    // Sede: si el proyecto la tiene fija (caso SMM), manda esa. Si no, se pondera.
    const sede = proyecto.sedeFija
      ? proyecto.sedeFija
      : elegirPonderado(rng, SEDES, SEDES.map((s) => s.peso)).nombre;

    // Fecha de creación dentro del año, con estacionalidad.
    const mes = elegirPonderado(
      rng,
      Array.from({ length: MESES_TRANSCURRIDOS }, (_, k) => k),
      PESO_MES,
    );
    const diaTope = mes === 7 ? 20 : new Date(Date.UTC(ANIO_DEMO, mes + 1, 0)).getUTCDate();
    const dia = enteroEntre(rng, 1, diaTope);
    const hora = enteroEntre(rng, 7, 19);
    const creacion = new Date(Date.UTC(ANIO_DEMO, mes, dia, hora, enteroEntre(rng, 0, 59)));

    const prioridad = elegirPonderado<Prioridad>(rng, ["Alta", "Media", "Baja"], [15, 55, 30]);

    const vocab = proyecto.vocabulario;
    const estados = ESTADOS_POR_VOCABULARIO[vocab];
    // Distribución de estados: la mayoría resuelve, una cola queda abierta.
    const pesosEstado = estados.map((e) => {
      const cat = categoriaDeEstado(e);
      if (cat === "resuelto") return 62;
      if (cat === "cancelado") return 6;
      if (cat === "en-progreso") return 14;
      if (cat === "esperando-terceros") return 9;
      return 12; // pendiente
    });
    const estadoTicket = elegirPonderado(rng, estados, pesosEstado);
    const categoria = categoriaDeEstado(estadoTicket);
    const cerrado = categoria === "resuelto" || categoria === "cancelado";

    // TTFR: casi todos responden rápido; una cola se pasa de las 4h.
    const ttfrHoras = Number(
      (rng() < 0.8 ? rng() * META_TTFR_HORAS : META_TTFR_HORAS + rng() * 30).toFixed(2),
    );

    // TTR: solo tiene valor si el ticket ya cerró.
    const metaTtr = META_TTR_HORAS[prioridad];
    const probabilidadCumpleTtr = PROBABILIDAD_CUMPLE_TTR[prioridad];
    const ttrHoras = cerrado
      ? Number((rng() < probabilidadCumpleTtr ? rng() * metaTtr : metaTtr + rng() * metaTtr * 5).toFixed(2))
      : null;

    const fechaCierre = cerrado
      ? new Date(creacion.getTime() + (ttrHoras ?? 0) * 3600_000 + enteroEntre(rng, 0, 36) * 3600_000)
      : null;

    // Última actualización: los cerrados quedan en su fecha de cierre;
    // los abiertos se mueven hace poco... o llevan semanas quietos (estancados).
    const fechaActualizacion = fechaCierre
      ? fechaCierre
      : new Date(
          Math.min(
            FECHA_CORTE.getTime() - (rng() < 0.7 ? rng() * 4 : 5 + rng() * 40) * 86_400_000,
            FECHA_CORTE.getTime(),
          ),
        );
    const actualizacionEfectiva = new Date(
      Math.max(fechaActualizacion.getTime(), creacion.getTime()),
    );

    // Comentarios: la mayoría poquitos, unos pocos son casos escalados con hilo
    // largo. La cola usa una ley de potencia (rng^3) en vez de un uniforme:
    // con uniforme, en 9.000 tickets salen decenas empatados en el tope y el
    // "top 5 con más comentarios" muestra cinco veces el mismo número, que se
    // ve fabricado. Con la cola así, los casos extremos son pocos y distintos.
    const comentarios =
      rng() < 0.88 ? enteroEntre(rng, 0, 7) : 8 + Math.floor(Math.pow(rng(), 3) * 95);

    const plantilla = PLANTILLAS_TITULO[Math.floor(rng() * PLANTILLAS_TITULO.length)];
    const tipoRequerimiento = TIPOS_REQUERIMIENTO[Math.floor(rng() * TIPOS_REQUERIMIENTO.length)];
    const titulo = plantilla
      .replace("{n}", String(enteroEntre(rng, 10000, 99999)))
      .replace("{t}", area.nombre.toLowerCase());

    tickets.push({
      clave: `${proyecto.clave}-${1000 + i}`,
      tituloTicket: titulo,
      proyecto: proyecto.nombre,
      proyectoClave: proyecto.clave,
      fechaCreacion: creacion.toISOString(),
      fechaCierre: fechaCierre ? fechaCierre.toISOString() : null,
      fechaActualizacion: actualizacionEfectiva.toISOString(),
      personaAsignada: equipo[Math.floor(rng() * equipo.length)],
      // A diferencia del equipo (3-6 personas fijas por área), el informador
      // se sortea sobre TODO el pool de nombres: son ciudadanos distintos,
      // no un equipo fijo — así no se repiten solo 3-6 nombres para miles de tickets.
      informador: NOMBRES[Math.floor(rng() * NOMBRES.length)],
      estadoTicket,
      categoriaEstado: categoria,
      prioridad,
      tipoIncidencia: TIPOS_INCIDENCIA[Math.floor(rng() * TIPOS_INCIDENCIA.length)],
      tipoRequerimiento,
      sede,
      area: area.nombre,
      areaSlug: area.slug,
      gerenciaSlug: area.gerencia,
      ttfrHoras,
      ttrHoras,
      ttfrIncumplido: ttfrHoras > META_TTFR_HORAS,
      ttrIncumplido: ttrHoras !== null && ttrHoras > metaTtr,
      comentarios,
      diasSinActualizar: Math.floor(
        (FECHA_CORTE.getTime() - actualizacionEfectiva.getTime()) / 86_400_000,
      ),
    });
  }

  return tickets;
}

let cache: Ticket[] | null = null;

/**
 * Dataset demo completo (~9.038 tickets). Se genera una sola vez por proceso.
 * Es puro: sin `Date.now()` ni `Math.random()`, así que servidor y cliente
 * ven exactamente lo mismo.
 */
export function ticketsDemo(): Ticket[] {
  if (cache) return cache;
  cache = AREAS.flatMap(generarTicketsDeArea);
  return cache;
}
