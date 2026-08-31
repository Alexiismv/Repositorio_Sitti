"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { paletaDe, useTema } from "@/components/tema";
import { numero } from "@/lib/formato";

/**
 * Gráficas del panel.
 *
 * Todas comparten rejilla, tipografía y paleta para que el tablero se lea como
 * un solo sistema y no como cinco widgets pegados. Los colores salen de la
 * marca SITTI; el rojo se reserva EXCLUSIVAMENTE para incumplimiento de meta —
 * si se usa para "categoría 3" pierde su significado de alerta.
 *
 * Dos decisiones que no son obvias:
 *
 * 1. **Los colores se leen del tema en React, no desde CSS.** Recharts escribe
 *    los colores como ATRIBUTOS del SVG (`stroke="..."`), y un atributo SVG no
 *    resuelve `var(--x)`. Si se dejara en CSS, en modo oscuro los ejes y la
 *    rejilla quedarían del color del tema claro.
 *
 * 2. **`isAnimationActive={false}` en todas las series.** En un tablero al que
 *    se entra y se sale, la animación se repite en cada navegación y cansa; y
 *    la animación de línea de Recharts se apoya en `stroke-dasharray`, así que
 *    si el gráfico se monta fuera del viewport el trazo puede quedar invisible
 *    — se ven los puntos sueltos sin la línea que los une.
 */

function useEstilos() {
  const { tema } = useTema();
  const p = paletaDe(tema);

  return {
    eje: { fontSize: 10.5, fontFamily: "var(--font-mono)", fill: p.eje },
    rejilla: p.rejilla,
    serieA: p.serieA,
    serieB: p.serieB,
    cursor: { fill: tema === "oscuro" ? "rgba(156,159,227,.10)" : "rgba(51,53,126,.05)" },
    leyenda: {
      fontSize: 11.5,
      fontFamily: "var(--font-sans)",
      paddingTop: 6,
      color: p.eje,
    },
    tooltip: {
      contentStyle: {
        borderRadius: 10,
        border: `1px solid ${p.borde}`,
        background: p.superficie,
        fontSize: 12,
        fontFamily: "var(--font-sans)",
        boxShadow: "0 8px 24px rgba(0,0,0,.18)",
      },
      labelStyle: { fontWeight: 600, color: p.texto, marginBottom: 4 },
      itemStyle: { color: p.texto },
      // Recharts tipa el valor como posiblemente `undefined`; se cubre ese caso.
      formatter: (v: unknown) => (v === undefined || v === null ? "—" : numero(Number(v))),
    },
  };
}

// ─────────────────────────────────────────────────────────────

export function GraficaCreadosVsResueltos({
  datos,
}: {
  datos: { mes: string; creados: number; resueltos: number }[];
}) {
  const e = useEstilos();

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={datos} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={e.rejilla} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="mes" tick={e.eje} axisLine={false} tickLine={false} />
        <YAxis tick={e.eje} axisLine={false} tickLine={false} width={46} />
        <Tooltip {...e.tooltip} />
        <Legend wrapperStyle={e.leyenda} iconType="plainline" />
        <Line
          isAnimationActive={false}
          type="monotone"
          dataKey="creados"
          name="Creados"
          stroke={e.serieA}
          strokeWidth={2.2}
          dot={{ r: 2.5 }}
          activeDot={{ r: 4.5 }}
        />
        <Line
          isAnimationActive={false}
          type="monotone"
          dataKey="resueltos"
          name="Resueltos"
          stroke={e.serieB}
          strokeWidth={2.2}
          dot={{ r: 2.5 }}
          activeDot={{ r: 4.5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * Comparativo semana vs. semana.
 *
 * Cada semana son DOS barras (creados y resueltos), y el valor va escrito
 * encima de cada una: leer la altura contra el eje Y obligaba a estimar, y con
 * dos series pegadas la comparación que importa — ¿resolvimos más de lo que
 * entró? — no se veía. El eje X lleva la fecha de cierre de cada semana y el
 * tooltip el rango completo.
 */
export function GraficaSemanal({
  datos,
}: {
  datos: { semana: string; rango: string; creados: number; resueltos: number }[];
}) {
  const e = useEstilos();
  const etiqueta = { ...e.eje, fontSize: 9.5, fontWeight: 600 };

  return (
    <ResponsiveContainer width="100%" height={216}>
      <BarChart data={datos} margin={{ top: 18, right: 8, left: -18, bottom: 0 }} barGap={3}>
        <CartesianGrid stroke={e.rejilla} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="semana" tick={e.eje} axisLine={false} tickLine={false} />
        <YAxis tick={e.eje} axisLine={false} tickLine={false} width={46} />
        <Tooltip
          {...e.tooltip}
          cursor={e.cursor}
          // El eje muestra solo el día de cierre; el tooltip sí da la semana completa.
          labelFormatter={(_v: unknown, carga: unknown) => {
            const fila = (carga as { payload?: { rango?: string } }[] | undefined)?.[0];
            return fila?.payload?.rango ?? "";
          }}
        />
        <Legend wrapperStyle={e.leyenda} iconType="circle" iconSize={7} />
        <Bar
          isAnimationActive={false}
          dataKey="creados"
          name="Creados"
          fill={e.serieA}
          radius={[3, 3, 0, 0]}
        >
          <LabelList dataKey="creados" position="top" offset={4} {...etiqueta} />
        </Bar>
        <Bar
          isAnimationActive={false}
          dataKey="resueltos"
          name="Resueltos"
          fill={e.serieB}
          radius={[3, 3, 0, 0]}
        >
          <LabelList dataKey="resueltos" position="top" offset={4} {...etiqueta} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Comparativo horizontal entre áreas / sedes / personas. */
export function GraficaComparativa({
  datos,
  altura = 260,
}: {
  datos: { nombre: string; total: number; color?: string }[];
  altura?: number;
}) {
  const e = useEstilos();

  return (
    <ResponsiveContainer width="100%" height={altura}>
      <BarChart data={datos} layout="vertical" margin={{ top: 4, right: 22, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={e.rejilla} strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={e.eje} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="nombre"
          tick={{ ...e.eje, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={150}
        />
        <Tooltip {...e.tooltip} cursor={e.cursor} />
        <Bar isAnimationActive={false} dataKey="total" name="Tickets" radius={[0, 4, 4, 0]}>
          {datos.map((d, i) => (
            <Cell key={i} fill={d.color ?? e.serieA} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Distribución de TTR contra la meta.
 * La línea de referencia es lo importante: sin ella el gráfico solo dice
 * "cuánto tardamos", con ella dice "cuánto nos pasamos".
 */
export function GraficaTtrVsMeta({
  datos,
  meta,
}: {
  datos: { rango: string; tickets: number; incumple: boolean }[];
  meta: number;
}) {
  const e = useEstilos();

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={datos} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={e.rejilla} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="rango" tick={e.eje} axisLine={false} tickLine={false} />
        <YAxis tick={e.eje} axisLine={false} tickLine={false} width={46} />
        <Tooltip {...e.tooltip} cursor={e.cursor} />
        <ReferenceLine
          x={`${meta}h`}
          stroke="#D64545"
          strokeDasharray="4 3"
          label={{ value: "Meta", position: "top", fill: "#D64545", fontSize: 10 }}
        />
        <Bar isAnimationActive={false} dataKey="tickets" name="Tickets" radius={[3, 3, 0, 0]}>
          {datos.map((d, i) => (
            <Cell key={i} fill={d.incumple ? "#D64545" : "#3FA9AC"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
