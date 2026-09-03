"use client";

import { useState, useTransition } from "react";

import { REGLAS_PASSWORD } from "@/lib/auth/password";

type Estado = { tipo: "listo" } | { tipo: "error"; mensaje: string };

export function FormularioCambioObligatorio() {
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "listo" });
  const [enviando, iniciarEnvio] = useTransition();

  const reglasCumplidas = REGLAS_PASSWORD.map((r) => ({ ...r, ok: r.cumple(passwordNueva) }));
  const todasCumplidas = reglasCumplidas.every((r) => r.ok);
  const coinciden = passwordConfirmar.length > 0 && passwordNueva === passwordConfirmar;
  const puedeEnviar = todasCumplidas && coinciden && !enviando;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar) return;
    setEstado({ tipo: "listo" });

    iniciarEnvio(async () => {
      try {
        const res = await fetch("/api/auth/completar-cambio-obligatorio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passwordNueva }),
        });
        const cuerpo = await res.json().catch(() => ({}));

        if (!res.ok) {
          setEstado({ tipo: "error", mensaje: cuerpo.error ?? "No se pudo actualizar la contraseña." });
          return;
        }

        // Navegación dura: ya existe la sesión completa (cookie nueva) y
        // el árbol de la app debe renderizarse leyéndola, igual que en el
        // login normal — ver la nota en login/formulario.tsx.
        window.location.assign("/");
      } catch {
        setEstado({ tipo: "error", mensaje: "No se pudo contactar el servidor. Revisa tu conexión." });
      }
    });
  }

  return (
    <form className="cp-form" onSubmit={enviar}>
      <label className="cp-label" htmlFor="cpo-nueva">
        Contraseña nueva
      </label>
      <input
        className="text-input"
        id="cpo-nueva"
        type="password"
        autoComplete="new-password"
        value={passwordNueva}
        onChange={(e) => setPasswordNueva(e.target.value)}
        required
        autoFocus
      />

      <ul className="cp-reglas">
        {reglasCumplidas.map((r) => (
          <li key={r.id} className={r.ok ? "ok" : ""}>
            <span className="cp-check" aria-hidden="true">
              {r.ok ? "✓" : "○"}
            </span>
            {r.descripcion}
          </li>
        ))}
      </ul>

      <label className="cp-label" htmlFor="cpo-confirmar">
        Confirmar contraseña nueva
      </label>
      <input
        className="text-input"
        id="cpo-confirmar"
        type="password"
        autoComplete="new-password"
        value={passwordConfirmar}
        onChange={(e) => setPasswordConfirmar(e.target.value)}
        required
      />
      {passwordConfirmar.length > 0 && !coinciden && (
        <p className="cp-aviso error" role="alert">
          Las dos contraseñas no coinciden.
        </p>
      )}

      {estado.tipo === "error" && (
        <p className="cp-aviso error" role="alert">
          {estado.mensaje}
        </p>
      )}

      <button className="submit-btn" type="submit" disabled={!puedeEnviar}>
        {enviando ? "Guardando…" : "Continuar"}
      </button>
    </form>
  );
}
