"use client";

import Link from "next/link";
import { useState } from "react";

import { numero, porcentaje } from "@/lib/formato";
import type { DetalleSede, Granularidad } from "@/lib/sedes-detalle";

const GRANULARIDADES: { key: Granularidad; label: string }[] = [
  { key: "anio", label: "Año" },
  { key: "mes", label: "Mes" },
  { key: "semana", label: "Semana" },
  { key: "dia", label: "Día" },
];

/**
 * Tarjeta de detalle: una sede concreta, o la vista consolidada "Todas".
 *
 * Es el MISMO componente para los dos casos a propósito. La vista consolidada
 * se calcula con la misma función que una sede, así que ambas comparten forma
 * y no hay dos tarjetas que mantener sincronizadas cuando cambie algo.
 *
 * Contenido pedido por Alexis para el detalle de sede: histórico
 * (año/mes/semana/día), total, pendientes, top 5 más antiguos sin resolver,
 * top 5 más comentados, tipo de requerimiento más solicitado y portal de JSM
 * más usado.
 */
export function PanelSede({
  detalle,
  esConsolidado,
}: {
  detalle: DetalleSede | null;
  esConsolidado: boolean;
}) {
  const [gran, setGran] = useState<Granularidad>("mes");

  if (!detalle) {
    return (
      <div className="mp-detalle">
        <div className="mp-vacio">
          <span className="titulo">Selecciona una sede</span>
          <p>
            Pasa el mouse sobre un pin del mapa, o usa los botones de arriba para elegir una sede.
          </p>
        </div>
      </div>
    );
  }

  const serie = detalle.historico[gran];
  const maximo = Math.max(1, ...serie.map((p) => p.valor));

  return (
    <div className="mp-detalle">
      <div className="mp-detalle-eyebrow">
        {esConsolidado
          ? "Vista consolidada"
          : detalle.aproximado
            ? "Ubicación agrupada"
            : "Sede de atención"}
      </div>
      <h3>{detalle.nombre}</h3>
      <p className="mp-dir">{detalle.direccion}</p>

      <div className="mp-kpis">
        <div className="mp-kpi">
          <div className="l">Total 2026</div>
          <div className="v">{numero(detalle.total)}</div>
        </div>
        <div className="mp-kpi">
          <div className="l">Pendientes</div>
          <div className="v" style={{ color: detalle.pendientes ? "var(--red)" : undefined }}>
            {numero(detalle.pendientes)}
          </div>
        </div>
        <div className="mp-kpi">
          <div className="l">Tipo más solicitado</div>
          <div className="v sm">{detalle.tipoMasSolicitado}</div>
        </div>
        <div className="mp-kpi">
          <div className="l">Portal más usado de Jira</div>
          <div className="v sm">{detalle.portalMasUsado}</div>
        </div>
      </div>

      <div className="mp-gran" role="group" aria-label="Granularidad del histórico">
        {GRANULARIDADES.map((g) => (
          <button
            key={g.key}
            type="button"
            className={gran === g.key ? "activo" : ""}
            onClick={() => setGran(g.key)}
            aria-pressed={gran === g.key}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="mp-spark" aria-hidden="true">
        {serie.map((p, i) => (
          <div className="col" key={`${p.etiqueta}-${i}`} title={`${p.etiqueta}: ${p.valor}`}>
            <div className="num">{numero(p.valor)}</div>
            <div className="pista">
              <div className="barra" style={{ height: `${(p.valor / maximo) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mp-spark-ejes">
        {serie.map((p, i) => (
          <span key={`e-${p.etiqueta}-${i}`}>{p.etiqueta}</span>
        ))}
      </div>
      <p className="sr-only">
        Histórico de tickets creados por {gran}: {serie.map((p) => `${p.etiqueta} ${p.valor}`).join(", ")}
      </p>

      <div className="mp-lista-label">Top 5 más antiguos sin resolver</div>
      {detalle.masAntiguos.length ? (
        detalle.masAntiguos.map((t) => (
          <div className="mp-lista-item" key={t.clave}>
            <span className="tid">{t.clave}</span>
            <span className="titulo">{t.titulo}</span>
            <span className="val alerta">{t.valor}</span>
          </div>
        ))
      ) : (
        <p className="nota-demo" style={{ marginTop: 0 }}>
          Sin tickets abiertos {esConsolidado ? "en la operación" : "en esta sede"}.
        </p>
      )}

      <div className="mp-lista-label">Top 5 con más comentarios</div>
      {detalle.masComentados.map((t) => (
        <div className="mp-lista-item" key={`c-${t.clave}`}>
          <span className="tid">{t.clave}</span>
          <span className="titulo">{t.titulo}</span>
          <span className={`val${t.alerta ? " alerta" : ""}`}>{t.valor}</span>
        </div>
      ))}

      <div className="mp-ver-mas">
        <p className="nota-demo" style={{ margin: "0 0 10px" }}>
          Área con más peso {esConsolidado ? "en total" : "aquí"}:{" "}
          <strong>{detalle.areaMasPesada}</strong> · cumplimiento de TTR{" "}
          {porcentaje(detalle.cumplimientoTtr)} · {numero(detalle.estancados)} tickets estancados.
        </p>
        <Link href={esConsolidado ? "/reportes" : `/reportes?sede=${detalle.slug}`}>
          {esConsolidado ? "Ver todos los tickets →" : "Ver todos los tickets de esta sede →"}
        </Link>
      </div>
    </div>
  );
}
