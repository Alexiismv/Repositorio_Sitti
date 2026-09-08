"use client";

import { useState } from "react";
import Link from "next/link";

import { numero, porcentaje } from "@/lib/formato";
import type { FilaAgrupada } from "@/lib/metricas";

type FilaPersona = FilaAgrupada & { ttrPromedio: number; estancados: number };

type Columna = "total" | "pendientes" | "estancados";
type Direccion = "asc" | "desc";

/**
 * Tabla del equipo de un área. Es cliente porque el orden se cambia al vuelo
 * sin recargar: quien coordina compara "quién tiene más pendientes" contra
 * "quién tiene más estancado" varias veces seguidas, y un round-trip por cada
 * clic haría ese barrido incómodo.
 */
export function TablaEquipo({
  personas,
  gerenciaSlug,
  areaSlug,
}: {
  personas: FilaPersona[];
  gerenciaSlug: string;
  areaSlug: string;
}) {
  const [columna, setColumna] = useState<Columna>("total");
  const [direccion, setDireccion] = useState<Direccion>("desc");

  const ordenar = (c: Columna) => {
    if (c === columna) {
      setDireccion((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setColumna(c);
      setDireccion("desc");
    }
  };

  const ordenadas = [...personas].sort((a, b) =>
    direccion === "desc" ? b[columna] - a[columna] : a[columna] - b[columna],
  );

  const href = (persona: string, extra: Record<string, string>) =>
    `/reportes?${new URLSearchParams({
      gerencia: gerenciaSlug,
      area: areaSlug,
      persona,
      ...extra,
    }).toString()}`;

  const encabezado = (c: Columna, etiqueta: string) => (
    <th className="num">
      <button type="button" className="th-orden" onClick={() => ordenar(c)}>
        {etiqueta}
        <span aria-hidden="true">{columna === c ? (direccion === "desc" ? " ↓" : " ↑") : " ⇅"}</span>
      </button>
    </th>
  );

  return (
    <div className="scroll-x">
      <table className="tabla">
        <thead>
          <tr>
            <th>Persona</th>
            {encabezado("total", "Tickets")}
            {encabezado("pendientes", "Pendientes")}
            {encabezado("estancados", "Estancados")}
            <th className="num">TTR promedio</th>
            <th className="num">Cumplimiento</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((p) => (
            <tr key={p.slug}>
              <td>{p.nombre}</td>
              <td className="num">{numero(p.total)}</td>
              <td className="num">
                {p.pendientes > 0 ? (
                  <Link
                    href={href(p.nombre, { estado: "pendientes" })}
                    title={`Ver los ${numero(p.pendientes)} pendientes de ${p.nombre} en esta área`}
                  >
                    {numero(p.pendientes)}
                  </Link>
                ) : (
                  numero(p.pendientes)
                )}
              </td>
              <td className="num" style={{ color: p.estancados ? "var(--red)" : undefined }}>
                {p.estancados > 0 ? (
                  <Link
                    href={href(p.nombre, { estancado: "1" })}
                    title={`Ver los ${numero(p.estancados)} estancados de ${p.nombre} en esta área`}
                  >
                    {numero(p.estancados)}
                  </Link>
                ) : (
                  numero(p.estancados)
                )}
              </td>
              <td className="num">{p.ttrPromedio.toLocaleString("es-CO")} h</td>
              <td className="num" style={{ color: p.cumplimientoTtr < 80 ? "var(--red)" : undefined }}>
                {porcentaje(p.cumplimientoTtr)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
