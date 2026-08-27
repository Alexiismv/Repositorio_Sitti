"use client";

import { useState, useTransition } from "react";

import { REGLAS_PASSWORD } from "@/lib/auth/password";

import "./cambiar-password.css";

type Estado = { tipo: "listo" } | { tipo: "ok" } | { tipo: "error"; mensaje: string };

export function FormularioCambiarPassword({ email }: { email: string }) {
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [estado, setEstado] = useState<Estado>({ tipo: "listo" });
  const [enviando, iniciarEnvio] = useTransition();

  const reglasCumplidas = REGLAS_PASSWORD.map((r) => ({ ...r, ok: r.cumple(passwordNueva) }));
  const todasCumplidas = reglasCumplidas.every((r) => r.ok);
  const coinciden = passwordConfirmar.length > 0 && passwordNueva === passwordConfirmar;
  const distintaDeLaActual =
    passwordActual.length === 0 || passwordNueva.length === 0 || passwordActual !== passwordNueva;

  const puedeEnviar =
    passwordActual.length > 0 && todasCumplidas && coinciden && distintaDeLaActual && !enviando;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!puedeEnviar) return;
    setEstado({ tipo: "listo" });

    iniciarEnvio(async () => {
      try {
        const res = await fetch("/api/auth/cambiar-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passwordActual, passwordNueva }),
        });
        const cuerpo = await res.json().catch(() => ({}));

        if (!res.ok) {
          setEstado({ tipo: "error", mensaje: cuerpo.error ?? "No se pudo cambiar la contraseña." });
          return;
        }

        setEstado({ tipo: "ok" });
        setPasswordActual("");
        setPasswordNueva("");
        setPasswordConfirmar("");
      } catch {
        setEstado({ tipo: "error", mensaje: "No se pudo contactar el servidor. Revisa tu conexión." });
      }
    });
  }

  return (
    <form className="cp-form" onSubmit={enviar}>
      <p className="cp-cuenta">
        Cuenta: <span className="mono">{email}</span>
      </p>

      <label className="cp-label" htmlFor="cp-actual">
        Contraseña actual
      </label>
      <input
        className="text-input"
        id="cp-actual"
        type="password"
        autoComplete="current-password"
        value={passwordActual}
        onChange={(e) => setPasswordActual(e.target.value)}
        required
      />

      <label className="cp-label" htmlFor="cp-nueva">
        Contraseña nueva
      </label>
      <input
        className="text-input"
        id="cp-nueva"
        type="password"
        autoComplete="new-password"
        value={passwordNueva}
        onChange={(e) => setPasswordNueva(e.target.value)}
        required
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
        <li className={distintaDeLaActual ? "ok" : ""}>
          <span className="cp-check" aria-hidden="true">
            {distintaDeLaActual ? "✓" : "○"}
          </span>
          Distinta de la contraseña actual
        </li>
      </ul>

      <label className="cp-label" htmlFor="cp-confirmar">
        Confirmar contraseña nueva
      </label>
      <input
        className="text-input"
        id="cp-confirmar"
        type="password"
        autoComplete="new-password"
        value={passwordConfirmar}
        onChange={(e) => setPasswordConfirmar(e.target.value)}
        required
      />
      {passwordConfirmar.length > 0 && !coinciden && (
        <p className="cp-aviso error" role="alert">
          Las dos contraseñas nuevas no coinciden.
        </p>
      )}

      {estado.tipo === "error" && (
        <p className="cp-aviso error" role="alert">
          {estado.mensaje}
        </p>
      )}
      {estado.tipo === "ok" && (
        <p className="cp-aviso ok" role="status">
          Contraseña actualizada. La usarás la próxima vez que inicies sesión.
        </p>
      )}

      <button className="submit-btn" type="submit" disabled={!puedeEnviar}>
        {enviando ? "Guardando…" : "Guardar contraseña nueva"}
      </button>
    </form>
  );
}
