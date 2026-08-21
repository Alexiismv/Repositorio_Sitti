"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Estado =
  | { tipo: "listo" }
  | { tipo: "sincronizando" }
  | { tipo: "ok"; mensaje: string }
  | { tipo: "error"; mensaje: string };

/**
 * Botón "Refrescar" del topbar.
 *
 * Trae de Jira lo que cambió y recarga la vista. Reemplaza la necesidad de
 * esperar a la sincronización programada: si alguien va a entrar a una reunión
 * y quiere el dato de este momento, lo pide aquí.
 *
 * Solo aparece para Gerente y Administrador — sincronizar reescribe la tabla
 * que todos ven, no es una acción de consulta.
 */
export function BotonRefrescar({ puedeSincronizar }: { puedeSincronizar: boolean }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: "listo" });

  if (!puedeSincronizar) return null;

  async function refrescar() {
    if (estado.tipo === "sincronizando") return;
    setEstado({ tipo: "sincronizando" });

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const cuerpo = await res.json().catch(() => ({}));

      if (!res.ok) {
        setEstado({ tipo: "error", mensaje: cuerpo.error ?? "No se pudo sincronizar." });
        return;
      }

      // En modo demo el endpoint responde 200 pero con `ok: false`: no es un
      // error, simplemente no hay nada que traer.
      if (cuerpo.ok === false) {
        setEstado({ tipo: "ok", mensaje: cuerpo.mensaje });
        return;
      }

      setEstado({ tipo: "ok", mensaje: cuerpo.mensaje ?? "Datos actualizados." });
      // `refresh()` revalida los Server Components: los números de la pantalla
      // se repintan con lo recién sincronizado, sin recargar la página entera.
      router.refresh();
    } catch {
      setEstado({
        tipo: "error",
        mensaje: "No se pudo contactar el servidor. Revisa tu conexión.",
      });
    }
  }

  const sincronizando = estado.tipo === "sincronizando";

  return (
    <div className="sh-refrescar-caja">
      <button
        type="button"
        className={`sh-refrescar${sincronizando ? " girando" : ""}`}
        onClick={refrescar}
        disabled={sincronizando}
        title="Traer de Jira los cambios más recientes"
        aria-label="Refrescar datos desde Jira"
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
        <span>{sincronizando ? "Sincronizando…" : "Refrescar"}</span>
      </button>

      {(estado.tipo === "ok" || estado.tipo === "error") && (
        <div
          className={`sh-refrescar-aviso ${estado.tipo}`}
          role="status"
          onClick={() => setEstado({ tipo: "listo" })}
        >
          {estado.mensaje}
          <span className="cerrar" aria-hidden="true">×</span>
        </div>
      )}
    </div>
  );
}
