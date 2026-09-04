"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { Perfil } from "@/lib/auth/tipos";
import type { CampoOrden, FilaUsuarioListado } from "@/lib/auth/usuarios-servicio";

import { ModalPerfilesUsuario } from "./modal-perfiles";
import { ModalRestablecerPassword } from "./modal-restablecer-password";

const TAMANOS_PAGINA = [5, 10, 25, 50];

const COLUMNAS: { campo: CampoOrden; etiqueta: string }[] = [
  { campo: "nombre", etiqueta: "Funcionario" },
  { campo: "email", etiqueta: "Usuario acceso" },
  { campo: "cargo", etiqueta: "Cargo" },
];

export function TablaUsuarios({
  usuarios,
  total,
  pagina,
  porPagina,
  orden,
  dir,
  perfiles,
}: {
  usuarios: FilaUsuarioListado[];
  total: number;
  pagina: number;
  porPagina: number;
  orden: CampoOrden;
  dir: "asc" | "desc";
  perfiles: Perfil[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [gestionandoPerfiles, setGestionandoPerfiles] = useState<FilaUsuarioListado | null>(null);
  const [restableciendoPassword, setRestableciendoPassword] = useState<FilaUsuarioListado | null>(null);

  const totalPaginas = Math.max(Math.ceil(total / porPagina), 1);

  function hrefOrden(campo: CampoOrden): string {
    const p = new URLSearchParams(params.toString());
    p.set("orden", campo);
    p.set("dir", orden === campo && dir === "asc" ? "desc" : "asc");
    p.set("pagina", "1");
    return `/admin/usuarios?${p.toString()}`;
  }

  function irAPagina(n: number) {
    const p = new URLSearchParams(params.toString());
    p.set("pagina", String(Math.min(Math.max(n, 1), totalPaginas)));
    router.push(`/admin/usuarios?${p.toString()}`);
  }

  function cambiarPorPagina(n: string) {
    const p = new URLSearchParams(params.toString());
    p.set("porPagina", n);
    p.set("pagina", "1");
    router.push(`/admin/usuarios?${p.toString()}`);
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ink-soft)" }}>
          Mostrar
          <select
            value={porPagina}
            onChange={(e) => cambiarPorPagina(e.target.value)}
            style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--line)", background: "var(--card)", color: "var(--ink)" }}
          >
            {TAMANOS_PAGINA.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          registros
        </label>
      </div>

      <div className="scroll-x">
        <table className="tabla">
          <thead>
            <tr>
              {COLUMNAS.map((c) => (
                <th key={c.campo}>
                  <Link href={hrefOrden(c.campo)} style={{ color: "inherit", textDecoration: "none" }}>
                    {c.etiqueta} {orden === c.campo ? (dir === "asc" ? "▲" : "▼") : ""}
                  </Link>
                </th>
              ))}
              <th>Perfiles</th>
              <th>Sede</th>
              <th>Activo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u, i) => (
              <tr key={u.id} style={{ background: i % 2 === 1 ? "var(--bg)" : undefined }}>
                <td style={{ fontWeight: 600 }}>
                  {u.nombre} {u.apellidos ?? ""}
                </td>
                <td className="mono" style={{ color: "var(--navy)" }}>
                  {u.email}
                </td>
                <td style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{u.cargoTexto}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => setGestionandoPerfiles(u)}
                    style={{ background: "none", border: "none", color: "var(--navy)", cursor: "pointer", padding: 0, font: "inherit", textDecoration: "underline" }}
                  >
                    Perfil
                  </button>
                </td>
                <td>{u.sedeNombre ?? "—"}</td>
                <td>
                  <span className={`semaforo ${u.activo ? "verde" : "rojo"}`} style={{ marginRight: 6 }} />
                  {u.activo ? "Sí" : "No"}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 10 }}>
                    <Link href={`/admin/usuarios/${u.id}`} title="Editar" aria-label={`Editar ${u.nombre}`}>
                      ✎
                    </Link>
                    <button
                      type="button"
                      onClick={() => setRestableciendoPassword(u)}
                      title="Restablecer contraseña"
                      aria-label={`Restablecer contraseña de ${u.nombre}`}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
                    >
                      🔑
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--ink-soft)", padding: "24px 0" }}>
                  No se encontraron usuarios con estos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12.5, color: "var(--ink-soft)" }}>
        <span>
          {total === 0 ? "0 resultados" : `Página ${pagina} de ${totalPaginas} · ${total} resultado(s)`}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn-secundario" onClick={() => irAPagina(pagina - 1)} disabled={pagina <= 1}>
            ← Anterior
          </button>
          <button type="button" className="btn-secundario" onClick={() => irAPagina(pagina + 1)} disabled={pagina >= totalPaginas}>
            Siguiente →
          </button>
        </div>
      </div>

      {gestionandoPerfiles && (
        <ModalPerfilesUsuario
          usuario={gestionandoPerfiles}
          perfilesDisponibles={perfiles}
          onCerrar={() => setGestionandoPerfiles(null)}
          onGuardado={() => {
            setGestionandoPerfiles(null);
            router.refresh();
          }}
        />
      )}

      {restableciendoPassword && (
        <ModalRestablecerPassword
          usuario={restableciendoPassword}
          onCerrar={() => setRestableciendoPassword(null)}
          onHecho={() => setRestableciendoPassword(null)}
        />
      )}
    </div>
  );
}
