import Link from "next/link";

import { decimal, numero } from "@/lib/formato";
import type { FilaAgrupada } from "@/lib/metricas";

/**
 * Piezas visuales compartidas. Son Server Components a propósito: no tienen
 * estado, así que no hay razón para mandar su JS al navegador.
 */

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-label">
      {children}
      <div className="line" />
    </div>
  );
}

export interface Kpi {
  label: string;
  valor: string;
  cap?: string;
  color?: string;
  /** Pinta el valor en rojo — reservado para métricas fuera de meta. */
  alerta?: boolean;
}

/**
 * Franja de KPIs.
 *
 * Se fuerza a 4 columnas en escritorio y 2 en móvil porque los sets de KPIs de
 * este panel son de 4: cualquier otro número (5, 6) dejaría una fila huérfana
 * de 1 tarjeta, que se lee como error de maquetación y no como decisión.
 * Si algún día hacen falta 6, van 3x2 — no 4+2.
 */
export function KpiStrip({ kpis }: { kpis: Kpi[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, minmax(0, 1fr))`,
        gap: 14,
      }}
      className="kpi-strip"
    >
      {kpis.map((k) => (
        <div
          key={k.label}
          className="kpi"
          style={{ ["--accent" as string]: k.color ?? "var(--navy)" }}
        >
          <div className="label">{k.label}</div>
          <div
            className={`val${k.valor.length > 9 ? " sm" : ""}`}
            style={k.alerta ? { color: "var(--red)" } : undefined}
          >
            {k.valor}
          </div>
          {k.cap && <div className="cap">{k.cap}</div>}
        </div>
      ))}
    </div>
  );
}

/** Ranking de barras — el patrón que ya validó Alexis en el prototipo. */
/**
 * Ranking con barra y peso relativo.
 *
 * La barra y el porcentaje miden cosas distintas a propósito, porque una sola
 * barra no puede con las dos:
 *
 *   - La BARRA se escala contra la fila mayor, para comparar filas entre sí.
 *     Escalarla contra el total no funciona cuando una fila domina: con Caribe
 *     en el 75% de los tickets, las otras cinco sedes quedaban en barras de
 *     ~10px y se leían como si no tuvieran barra.
 *   - El PORCENTAJE va como texto y sí es sobre el total, que es el dato que
 *     una barra corta no alcanza a comunicar.
 *
 * El porcentaje lleva un decimal: con enteros, sedes del 3,5% y del 4,0%
 * se mostraban las dos como "4%".
 */
export function Ranking({
  filas,
  href,
  total,
}: {
  filas: FilaAgrupada[];
  /** Si se pasa, cada fila enlaza a `${href}/${slug}`. */
  href?: string;
  /**
   * Universo para el porcentaje. Por defecto la suma de las filas; se pasa
   * explícito cuando el ranking no cubre todo el conjunto.
   */
  total?: number;
}) {
  const tope = Math.max(1, ...filas.map((f) => f.total));
  const universo = total || filas.reduce((a, f) => a + f.total, 0) || 1;

  return (
    <div>
      {filas.map((f) => {
        const contenido = (
          <>
            <span className="name">{f.nombre}</span>
            <span className="track">
              <span
                className="fill"
                style={{ width: `${(f.total / tope) * 100}%`, background: f.color ?? "var(--navy)" }}
              />
            </span>
            <span className="pct">{decimal((f.total / universo) * 100, 1)}%</span>
            <span className="num">{numero(f.total)}</span>
          </>
        );

        return href ? (
          <Link
            key={f.slug}
            href={`${href}/${f.slug}`}
            className="rank-row"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            {contenido}
          </Link>
        ) : (
          <div className="rank-row" key={f.slug}>
            {contenido}
          </div>
        );
      })}
    </div>
  );
}

/** Tarjeta de gerencia / área del ranking de impacto (Nivel 1 y Nivel 2). */
export function TarjetaNivel({
  href,
  rank,
  titulo,
  total,
  proporcion,
  pie,
  color,
  etiqueta,
}: {
  href: string;
  rank: number;
  titulo: string;
  total: number;
  proporcion: number;
  pie: string;
  color: string;
  etiqueta?: string;
}) {
  return (
    <Link href={href} className="tarjeta-nivel" style={{ ["--accent" as string]: color }}>
      <div className="tn-top">
        <span className="mono tn-rank">#{rank}</span>
        {etiqueta && <span className="tn-tag">{etiqueta}</span>}
      </div>
      <h3>
        {titulo} <span className="tn-arrow">→</span>
      </h3>
      <div className="tn-metric">
        <span className="tn-num">{numero(total)}</span>
        <span className="tn-unit">tickets</span>
      </div>
      <div className="tn-bar">
        <div className="tn-fill" style={{ width: `${Math.max(proporcion, 2)}%` }} />
      </div>
      <div className="tn-cap mono">{pie}</div>
    </Link>
  );
}

export function EstadoVacio({ titulo, mensaje }: { titulo: string; mensaje: string }) {
  return (
    <div className="panel" style={{ textAlign: "center", padding: "44px 24px" }}>
      <div className="h-display" style={{ fontSize: 16, marginBottom: 8 }}>
        {titulo}
      </div>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0, lineHeight: 1.55 }}>
        {mensaje}
      </p>
    </div>
  );
}

/**
 * Cuántas columnas usar para no dejar una fila huérfana de 1 tarjeta.
 *
 * El problema real: las 7 gerencias en un grid de 3 dan 3+3+1, y esa última
 * tarjeta sola se lee como error de maquetación. Y N cambia según los permisos
 * del usuario — un coordinador puede ver 2, un gerente 7 — así que no sirve
 * cuadrar a mano el N de hoy.
 *
 * Se prueban 3, 2 y 4 columnas en ese orden y se toma la primera que no deje
 * resto 1. N pequeños (1, 2, 3) usan N columnas directo.
 *
 *   7 -> 4 (4+3)   ·   6 -> 3 (3+3)   ·   5 -> 3 (3+2)   ·   4 -> 2 (2+2)
 */
export function columnasSinHuerfano(n: number): number {
  if (n <= 3) return Math.max(n, 1);
  for (const c of [3, 2, 4]) {
    const resto = n % c;
    if (resto === 0 || resto > 1) return c;
  }
  return 3;
}

export function GridTarjetas({ children, n }: { children: React.ReactNode; n: number }) {
  return (
    <div
      className="grid-tarjetas"
      style={{ ["--cols" as string]: String(columnasSinHuerfano(n)) }}
    >
      {children}
    </div>
  );
}
