"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Combobox } from "@/components/combobox";
import type { Perfil } from "@/lib/auth/tipos";
import type { Sede } from "@/lib/catalogo";

/**
 * Barra de búsqueda y filtros (spec 1.1). URL-driven, mismo criterio que
 * `reportes/filtros.tsx`: un link a esta pantalla con filtros aplicados se
 * puede compartir y recarga exactamente igual.
 */
export function FiltrosUsuarios({ perfiles, sedes }: { perfiles: Perfil[]; sedes: Sede[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();

  const [texto, setTexto] = useState(params.get("q") ?? "");
  const [activo, setActivo] = useState(params.get("activo") ?? "");
  const [perfil, setPerfil] = useState(params.get("perfil") ?? "");
  const [sede, setSede] = useState(params.get("sede") ?? "");

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const nuevos = new URLSearchParams();
    if (texto.trim()) nuevos.set("q", texto.trim());
    if (activo) nuevos.set("activo", activo);
    if (perfil) nuevos.set("perfil", perfil);
    if (sede) nuevos.set("sede", sede);
    // Filtro nuevo: siempre vuelve a la página 1.
    iniciar(() => router.push(`/admin/usuarios?${nuevos.toString()}`));
  }

  function limpiar() {
    setTexto("");
    setActivo("");
    setPerfil("");
    setSede("");
    iniciar(() => router.push("/admin/usuarios"));
  }

  return (
    <form className="filtros" onSubmit={buscar}>
      <div className="filtros-grid">
        <div className="filtro-campo" style={{ gridColumn: "span 2" }}>
          <label htmlFor="u-buscar">Buscar</label>
          <input
            id="u-buscar"
            type="text"
            className="text-input"
            placeholder="Nombre funcionario o Usuario acceso o Número de documento"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>

        <div className="filtro-campo">
          <label>Activo</label>
          <Combobox
            opciones={[
              { valor: "si", nombre: "Sí" },
              { valor: "no", nombre: "No" },
            ]}
            valor={activo}
            onChange={setActivo}
            etiquetaVacio="Todos"
          />
        </div>

        <div className="filtro-campo">
          <label>Cargo</label>
          <Combobox
            opciones={perfiles.map((p) => ({ valor: p.id, nombre: p.nombre }))}
            valor={perfil}
            onChange={setPerfil}
            etiquetaVacio="Todos"
          />
        </div>

        <div className="filtro-campo">
          <label>Sede</label>
          <Combobox
            opciones={sedes.map((s) => ({ valor: s.slug, nombre: s.nombre }))}
            valor={sede}
            onChange={setSede}
            etiquetaVacio="Todas"
          />
        </div>
      </div>

      <div className="filtros-pie">
        <button type="button" className="btn-secundario" onClick={limpiar} disabled={pendiente}>
          Limpiar filtros
        </button>
        <button type="submit" className="btn-primario" disabled={pendiente}>
          {pendiente ? "Buscando…" : "Buscar"}
        </button>
      </div>
    </form>
  );
}
