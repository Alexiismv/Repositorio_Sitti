/**
 * Piezas compartidas del PDF ejecutivo — la contraparte de `components/ui.tsx`
 * pero para @react-pdf/renderer, que no puede reusar componentes de HTML/CSS.
 *
 * Se usan las fuentes core del PDF (Helvetica) a propósito: cubren tildes y
 * eñes sin tener que empaquetar archivos de fuente, y el documento pesa unos
 * KB en vez de varios MB.
 */

import { StyleSheet, Text, View } from "@react-pdf/renderer";

export const COLOR = {
  navy: "#242868",
  navyDeep: "#181B4A",
  orange: "#F1592A",
  gold: "#F6A623",
  teal: "#2FAFA0",
  ink: "#1B1D3A",
  inkSoft: "#6B6E8C",
  linea: "#E4E5F0",
  red: "#D64545",
  bg: "#F7F8FB",
};

export const estilos = StyleSheet.create({
  pagina: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: COLOR.ink,
    padding: 32,
  },
  eyebrow: {
    fontSize: 8,
    color: COLOR.teal,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  titulo: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: COLOR.navy,
    marginBottom: 3,
  },
  subtitulo: {
    fontSize: 9.5,
    color: COLOR.inkSoft,
    marginBottom: 2,
  },
  meta: {
    fontSize: 7.5,
    color: COLOR.inkSoft,
    marginTop: 6,
    marginBottom: 14,
  },
  seccion: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    color: COLOR.ink,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.linea,
    paddingBottom: 4,
  },
  kpiFila: {
    flexDirection: "row",
    gap: 8,
  },
  kpiCaja: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLOR.linea,
    borderRadius: 4,
    padding: 8,
  },
  kpiLabel: {
    fontSize: 7.5,
    color: COLOR.inkSoft,
    marginBottom: 4,
  },
  kpiValor: {
    fontFamily: "Helvetica-Bold",
    fontSize: 15,
  },
  kpiCap: {
    fontSize: 6.5,
    color: COLOR.inkSoft,
    marginTop: 3,
  },
  barraFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3.5,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.linea,
  },
  barraNombre: {
    width: 130,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  barraTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLOR.bg,
    borderRadius: 3,
  },
  barraFill: {
    height: 6,
    borderRadius: 3,
  },
  barraPct: {
    width: 34,
    fontSize: 7.5,
    textAlign: "right",
  },
  barraNum: {
    width: 42,
    fontSize: 7.5,
    color: COLOR.inkSoft,
    textAlign: "right",
  },
  tablaEncabezado: {
    flexDirection: "row",
    backgroundColor: COLOR.navy,
    borderRadius: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tablaEncabezadoTexto: {
    color: "#FFFFFF",
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
  },
  tablaFila: {
    flexDirection: "row",
    paddingVertical: 3.5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.linea,
  },
  tablaCelda: {
    fontSize: 7.5,
  },
  pie: {
    position: "absolute",
    bottom: 18,
    left: 32,
    right: 32,
    fontSize: 7,
    color: COLOR.inkSoft,
    textAlign: "center",
  },
});

export function Encabezado({
  eyebrow,
  titulo,
  subtitulo,
  generadoPor,
}: {
  eyebrow: string;
  titulo: string;
  subtitulo?: string;
  generadoPor: string;
}) {
  const fecha = new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <View>
      <Text style={estilos.eyebrow}>{eyebrow}</Text>
      <Text style={estilos.titulo}>{titulo}</Text>
      {subtitulo && <Text style={estilos.subtitulo}>{subtitulo}</Text>}
      <Text style={estilos.meta}>
        Generado el {fecha} (hora de Colombia) por {generadoPor} · SITTI — Panel de Gestión
      </Text>
    </View>
  );
}

export interface KpiPdf {
  label: string;
  valor: string;
  cap?: string;
  color?: string;
}

export function Kpis({ items }: { items: KpiPdf[] }) {
  return (
    <View style={estilos.kpiFila}>
      {items.map((k) => (
        <View key={k.label} style={[estilos.kpiCaja, { borderTopWidth: 2, borderTopColor: k.color ?? COLOR.navy }]}>
          <Text style={estilos.kpiLabel}>{k.label}</Text>
          <Text style={estilos.kpiValor}>{k.valor}</Text>
          {k.cap && <Text style={estilos.kpiCap}>{k.cap}</Text>}
        </View>
      ))}
    </View>
  );
}

export function SeccionTitulo({ children }: { children: string }) {
  return <Text style={estilos.seccion}>{children}</Text>;
}

export interface FilaBarra {
  nombre: string;
  total: number;
  color?: string;
}

/**
 * Lista con barra + % del total + conteo — el mismo patrón que `Ranking` en
 * la app (barra escalada contra la fila mayor, porcentaje sobre el universo
 * como texto), para que el PDF no contradiga lo que se ve en pantalla.
 */
export function ListaBarras({
  filas,
  universo,
  limite = 10,
}: {
  filas: FilaBarra[];
  universo: number;
  limite?: number;
}) {
  const visibles = filas.slice(0, limite);
  const tope = Math.max(1, ...visibles.map((f) => f.total));
  const base = universo || 1;

  return (
    <View>
      {visibles.map((f) => (
        <View key={f.nombre} style={estilos.barraFila}>
          <Text style={estilos.barraNombre}>{f.nombre}</Text>
          <View style={estilos.barraTrack}>
            <View
              style={[
                estilos.barraFill,
                { width: `${(f.total / tope) * 100}%`, backgroundColor: f.color ?? COLOR.navy },
              ]}
            />
          </View>
          <Text style={estilos.barraPct}>{((f.total / base) * 100).toFixed(1)}%</Text>
          <Text style={estilos.barraNum}>{f.total.toLocaleString("es-CO")}</Text>
        </View>
      ))}
    </View>
  );
}

export interface ColumnaTabla<T> {
  header: string;
  ancho?: number;
  render: (fila: T) => string;
  alinearDerecha?: boolean;
}

export function TablaPdf<T>({ columnas, filas }: { columnas: ColumnaTabla<T>[]; filas: T[] }) {
  return (
    <View>
      <View style={estilos.tablaEncabezado}>
        {columnas.map((c) => (
          <Text
            key={c.header}
            style={[estilos.tablaEncabezadoTexto, { flex: c.ancho ?? 1, textAlign: c.alinearDerecha ? "right" : "left" }]}
          >
            {c.header}
          </Text>
        ))}
      </View>
      {filas.map((fila, i) => (
        <View key={i} style={estilos.tablaFila} wrap={false}>
          {columnas.map((c) => (
            <Text
              key={c.header}
              style={[estilos.tablaCelda, { flex: c.ancho ?? 1, textAlign: c.alinearDerecha ? "right" : "left" }]}
            >
              {c.render(fila)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function Pie() {
  return (
    <Text style={estilos.pie} fixed>
      SITTI — Secretaría de Movilidad de Medellín · Documento de uso interno, generado automáticamente
    </Text>
  );
}
