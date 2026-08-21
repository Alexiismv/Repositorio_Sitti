"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { AREAS, GERENCIAS, SEDES, TIPOS_REQUERIMIENTO } from "@/lib/catalogo";

/**
 * Filtros dinámicos de reportes.
 *
 * Van a la URL como query params a propósito, no a estado local: así un
 * gerente puede pegar el link de "Cartera, sede Caribe, solo pendientes" en el
 * chat de una reunión y el otro ve exactamente lo mismo. Con estado en memoria
 * ese link no existiría.
 *
 * El submit es GET nativo — sin JS igual funciona.
 */
export function FiltrosReporte({ personas }: { personas: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();

  const valor = (k: string) => params.get(k) ?? "";

  function aplicar(form: HTMLFormElement) {
    const datos = new FormData(form);
    const nuevos = new URLSearchParams();
    for (const [k, v] of datos.entries()) {
      if (typeof v === "string" && v.trim()) nuevos.set(k, v);
    }
    iniciar(() => router.push(`/reportes?${nuevos.toString()}`));
  }

  return (
    <form
      className="filtros"
      onSubmit={(e) => {
        e.preventDefault();
        aplicar(e.currentTarget);
      }}
    >
      <div className="filtros-grid">
        <div className="filtro-campo">
          <label htmlFor="f-gerencia">Gerencia</label>
          <select id="f-gerencia" name="gerencia" defaultValue={valor("gerencia")}>
            <option value="">Todas</option>
            {GERENCIAS.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="filtro-campo">
          <label htmlFor="f-area">Área</label>
          <select id="f-area" name="area" defaultValue={valor("area")}>
            <option value="">Todas</option>
            {AREAS.map((a) => (
              <option key={a.slug} value={a.slug}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="filtro-campo">
          <label htmlFor="f-sede">Sede</label>
          <select id="f-sede" name="sede" defaultValue={valor("sede")}>
            <option value="">Todas</option>
            {SEDES.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="filtro-campo">
          <label htmlFor="f-persona">Persona asignada</label>
          <select id="f-persona" name="persona" defaultValue={valor("persona")}>
            <option value="">Todas</option>
            {personas.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="filtro-campo">
          <label htmlFor="f-estado">Estado</label>
          <select id="f-estado" name="estado" defaultValue={valor("estado")}>
            <option value="">Todos</option>
            <option value="pendientes">Pendientes</option>
            <option value="resueltos">Resueltos</option>
          </select>
        </div>

        <div className="filtro-campo">
          <label htmlFor="f-tipo">Tipo de requerimiento</label>
          <select id="f-tipo" name="tipo" defaultValue={valor("tipo")}>
            <option value="">Todos</option>
            {TIPOS_REQUERIMIENTO.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="filtro-campo">
          <label htmlFor="f-desde">Creado desde</label>
          <input id="f-desde" name="desde" type="date" defaultValue={valor("desde")} />
        </div>

        <div className="filtro-campo">
          <label htmlFor="f-hasta">Creado hasta</label>
          <input id="f-hasta" name="hasta" type="date" defaultValue={valor("hasta")} />
        </div>
      </div>

      <div className="filtros-pie">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--ink-soft)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            name="rojo"
            value="1"
            defaultChecked={valor("rojo") === "1"}
            style={{ accentColor: "var(--red)", width: 15, height: 15 }}
          />
          Solo tickets en rojo (fuera de meta de TTR o TTFR)
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn-secundario"
            onClick={() => iniciar(() => router.push("/reportes"))}
          >
            Limpiar
          </button>
          <button type="submit" className="btn-primario" disabled={pendiente}>
            {pendiente ? "Aplicando…" : "Aplicar filtros"}
          </button>
        </div>
      </div>
    </form>
  );
}
