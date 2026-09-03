"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

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
 *
 * Área es hija de Gerencia (la relación vive en `Area.gerencia`, ver
 * `catalogo.ts`): el listado de Área que se ofrece aquí SIEMPRE se filtra por
 * la Gerencia elegida, para que no se pueda armar una combinación imposible
 * (cero tickets garantizados) como Gerencia="Operación Contravencional" +
 * Área="Conexión de Soluciones". Una Gerencia puede tener varias Áreas
 * seleccionadas a la vez, por eso Área es multi-selección y Gerencia no.
 */
export function FiltrosReporte({ personas }: { personas: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();

  const valor = (k: string) => params.get(k) ?? "";

  const [gerenciaSel, setGerenciaSel] = useState(valor("gerencia"));
  const [areasSel, setAreasSel] = useState<string[]>(params.getAll("area"));
  const [areaAbierta, setAreaAbierta] = useState(false);
  const areaRef = useRef<HTMLDivElement>(null);

  const areasDisponibles = gerenciaSel ? AREAS.filter((a) => a.gerencia === gerenciaSel) : AREAS;

  const areaResumen =
    areasSel.length === 0
      ? "Todas"
      : areasSel.length === 1
        ? (AREAS.find((a) => a.slug === areasSel[0])?.nombre ?? areasSel[0])
        : `${areasSel.length} áreas seleccionadas`;

  // Cierra el desplegable de Área al hacer clic fuera — el mismo
  // comportamiento que un <select> nativo.
  useEffect(() => {
    if (!areaAbierta) return;
    function alClicFuera(e: MouseEvent) {
      if (areaRef.current && !areaRef.current.contains(e.target as Node)) setAreaAbierta(false);
    }
    document.addEventListener("mousedown", alClicFuera);
    return () => document.removeEventListener("mousedown", alClicFuera);
  }, [areaAbierta]);

  function cambiarGerencia(slug: string) {
    setGerenciaSel(slug);
    // Blindaje: si el área que estaba marcada ya no pertenece a la gerencia
    // recién elegida, se destilda sola — no se puede dejar una combinación
    // Gerencia/Área que no existe en los datos.
    setAreasSel((actual) =>
      slug ? actual.filter((s) => AREAS.find((a) => a.slug === s)?.gerencia === slug) : actual,
    );
  }

  function alternarArea(slug: string) {
    setAreasSel((actual) => (actual.includes(slug) ? actual.filter((s) => s !== slug) : [...actual, slug]));
  }

  function aplicar(form: HTMLFormElement) {
    const datos = new FormData(form);
    const nuevos = new URLSearchParams();
    for (const [k, v] of datos.entries()) {
      // "area" se arma aparte desde `areasSel`, no desde el form: los
      // checkboxes solo existen en el DOM mientras el desplegable está
      // abierto, así que FormData no puede depender de ellos.
      if (k === "area") continue;
      if (typeof v === "string" && v.trim()) nuevos.append(k, v);
    }
    for (const slug of areasSel) nuevos.append("area", slug);
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
          <select
            id="f-gerencia"
            name="gerencia"
            value={gerenciaSel}
            onChange={(e) => cambiarGerencia(e.target.value)}
          >
            <option value="">Todas</option>
            {GERENCIAS.map((g) => (
              <option key={g.slug} value={g.slug}>
                {g.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="filtro-campo filtro-campo-area" ref={areaRef}>
          <label htmlFor="f-area-btn">Área</label>
          <button
            type="button"
            id="f-area-btn"
            className="filtro-desplegable-trigger"
            aria-haspopup="listbox"
            aria-expanded={areaAbierta}
            onClick={() => setAreaAbierta((v) => !v)}
          >
            <span>{areaResumen}</span>
            <span className="filtro-desplegable-flecha" aria-hidden="true">
              ▾
            </span>
          </button>
          {areaAbierta && (
            <div className="filtro-checklist filtro-checklist-flotante" role="listbox">
              <label className="filtro-checklist-item">
                <input type="checkbox" checked={areasSel.length === 0} onChange={() => setAreasSel([])} />
                <span className="filtro-checklist-nombre">Todas</span>
              </label>
              {areasDisponibles.map((a) => (
                <label key={a.slug} className="filtro-checklist-item">
                  <input
                    type="checkbox"
                    checked={areasSel.includes(a.slug)}
                    onChange={() => alternarArea(a.slug)}
                  />
                  <span className="filtro-checklist-nombre">{a.nombre}</span>
                </label>
              ))}
            </div>
          )}
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
