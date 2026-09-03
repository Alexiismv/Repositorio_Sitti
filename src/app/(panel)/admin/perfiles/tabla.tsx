"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast-provider";
import type { Perfil } from "@/lib/auth/tipos";

export function TablaPerfiles({ perfiles }: { perfiles: Perfil[] }) {
  const router = useRouter();
  const { notificar } = useToast();
  const [aEliminar, setAEliminar] = useState<Perfil | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function confirmarEliminar() {
    if (!aEliminar) return;
    setEnviando(true);
    try {
      const res = await fetch(`/api/admin/perfiles/${aEliminar.id}`, { method: "DELETE" });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) {
        notificar(datos.error ?? "No se pudo eliminar el perfil.", "error");
      } else {
        notificar(`Perfil "${aEliminar.nombre}" eliminado.`, "ok");
        router.refresh();
      }
    } catch {
      notificar("No se pudo eliminar el perfil.", "error");
    } finally {
      setEnviando(false);
      setAEliminar(null);
    }
  }

  return (
    <div className="panel">
      <div className="scroll-x">
        <table className="tabla">
          <thead>
            <tr>
              <th>Nombre del perfil</th>
              <th>Descripción</th>
              <th>Usuarios</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {perfiles.map((p, i) => (
              <tr key={p.id} style={{ background: i % 2 === 1 ? "var(--bg)" : undefined }}>
                <td style={{ fontWeight: 600 }}>
                  {p.nombre}
                  {p.esSistema && (
                    <span className="tn-tag" style={{ marginLeft: 8 }}>
                      Sistema
                    </span>
                  )}
                </td>
                <td style={{ color: "var(--ink-soft)", fontSize: 12.5 }}>{p.descripcion ?? "—"}</td>
                <td className="num">{p.cantidadUsuarios ?? 0}</td>
                <td>
                  <span className={`semaforo ${p.activo ? "verde" : "rojo"}`} style={{ marginRight: 6 }} />
                  {p.activo ? "Activo" : "Inactivo"}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 10 }}>
                    <Link
                      href={`/admin/perfiles/${p.id}`}
                      title="Editar / ver detalle"
                      aria-label={`Editar perfil ${p.nombre}`}
                    >
                      ✎
                    </Link>
                    {!p.esSistema && (
                      <button
                        type="button"
                        onClick={() => setAEliminar(p)}
                        title="Eliminar"
                        aria-label={`Eliminar perfil ${p.nombre}`}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)" }}
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {perfiles.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--ink-soft)", padding: "24px 0" }}>
                  Todavía no hay perfiles creados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        abierto={aEliminar !== null}
        onCerrar={() => setAEliminar(null)}
        titulo="Eliminar perfil"
        pie={
          <>
            <button type="button" className="btn-secundario" onClick={() => setAEliminar(null)} disabled={enviando}>
              Cancelar
            </button>
            <button type="button" className="btn-primario" onClick={confirmarEliminar} disabled={enviando}>
              {enviando ? "Eliminando…" : "Sí, eliminar"}
            </button>
          </>
        }
      >
        <p style={{ margin: 0 }}>
          ¿Está seguro que desea eliminar el perfil <strong>{aEliminar?.nombre}</strong>? Esta acción no se
          puede deshacer.
        </p>
      </Modal>
    </div>
  );
}
