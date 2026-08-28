"use client";

import { useState, useTransition } from "react";

import { ROL_LABEL, type Rol } from "@/lib/auth/tipos";

/** Lo mínimo para pintar la cajita de demo. Lo arma el servidor. */
export interface CuentaDemo {
  email: string;
  rol: Rol;
  password: string;
}

/**
 * Formulario de login.
 *
 * El diseño está congelado (prototipo aprobado). Lo único que se agrega es
 * el caso de error y — solo en DEMO — una cajita con las cuentas de prueba,
 * para que quien abra la demo pueda entrar sin preguntarle nada a nadie.
 *
 * Las cuentas llegan por prop y NO se importan acá. Este componente es
 * `"use client"`: al importar `USUARIOS_DEMO` de forma estática, el array
 * entero —correos, roles y la contraseña— viajaba al navegador en el bundle
 * de producción aunque la cajita nunca se pintara. Estaba publicado en el JS
 * de la URL pública. Con la prop, si el servidor no las manda, no existen.
 *
 * Nota para la migración a SSO (Azure AD): cuando llegue ese momento, este
 * componente se reemplaza por un botón "Continuar con Microsoft" y la pantalla
 * de al lado no cambia nada.
 */
export function FormularioLogin({ cuentasDemo }: { cuentasDemo?: CuentaDemo[] }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();
  const [verPassword, setVerPassword] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password }),
    });

    if (!res.ok) {
      const cuerpo = await res.json().catch(() => ({}));
      setError(cuerpo.error ?? "No pudimos iniciar sesión. Intenta de nuevo.");
      return;
    }

    // Navegación dura a propósito, no `router.replace`.
    // La cookie de sesión acaba de nacer y todo el árbol de la app se renderiza
    // en el servidor leyéndola. Una navegación cliente puede servir el Router
    // Cache anterior (el de "sin sesión") y dejar al usuario mirando el login
    // aunque ya esté autenticado. Un login ocurre una vez cada 2 horas: la
    // recarga completa no cuesta nada y elimina toda esa clase de bug.
    iniciarEnvio(() => {
      window.location.assign("/");
    });
  }

  function usarCuenta(cuenta: CuentaDemo) {
    setUsuario(cuenta.email);
    setPassword(cuenta.password);
    setError(null);
  }

  return (
    <>
      <form className="lg-form" onSubmit={enviar}>
        <label className="lg-label" htmlFor="usuario">
          Usuario
        </label>
        <input
          className="text-input"
          id="usuario"
          type="text"
          placeholder="nombre.apellido"
          autoComplete="username"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          required
        />

        <label className="lg-label" htmlFor="password">
          Contraseña
        </label>
        <div className="lg-password-wrap">
          <input
            className="text-input"
            id="password"
            type={verPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="lg-password-toggle"
            onClick={() => setVerPassword((v) => !v)}
            aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={verPassword}
          >
            {verPassword ? (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path
                  d="M3 3l18 18M10.58 10.58a2 2 0 002.83 2.83M9.36 5.11A9.99 9.99 0 0112 5c5 0 9 4.5 10 7-.44 1-1.36 2.51-2.7 3.79M6.6 6.6C4.53 8.02 2.9 10.06 2 12c1 2.5 5 7 10 7 1.36 0 2.63-.28 3.77-.77"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                <path
                  d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            )}
          </button>
        </div>

        <div className="lg-row">
          <label className="lg-remember">
            <input type="checkbox" /> Recordarme
          </label>
          <button
            type="button"
            className="lg-forgot"
            onClick={() =>
              setError(
                "La recuperación de contraseña la gestiona el Administrador: escríbele a Mesa de Ayuda SITTI para que te la restablezca.",
              )
            }
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        {error && (
          <p className="lg-error" role="alert">
            {error}
          </p>
        )}

        <button className="submit-btn lg-submit" type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Ingresar"}
        </button>
      </form>

      {cuentasDemo && cuentasDemo.length > 0 && (
        <div className="lg-demo-box">
          <div className="lg-demo-title">Modo demo · cuentas de prueba</div>
          {cuentasDemo.map((c) => (
            <button
              key={c.email}
              type="button"
              className="lg-demo-user"
              onClick={() => usarCuenta(c)}
            >
              <span className="lg-demo-name">{c.email}</span>
              <span className="lg-demo-role">{ROL_LABEL[c.rol]}</span>
            </button>
          ))}
          <p className="nota-demo" style={{ marginTop: 10 }}>
            Contraseña para todas: <span className="mono">{cuentasDemo[0].password}</span>. Haz
            clic en una cuenta para llenar el formulario. Con{" "}
            <span className="mono">Carlos Múnera</span> se ve el recorte real de un coordinador.
          </p>
        </div>
      )}
    </>
  );
}
