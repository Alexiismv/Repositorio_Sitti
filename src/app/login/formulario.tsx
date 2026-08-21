"use client";

import { useState, useTransition } from "react";

import { USUARIOS_DEMO } from "@/lib/auth/usuarios-demo";
import { ROL_LABEL } from "@/lib/auth/tipos";

/**
 * Formulario de login.
 *
 * El diseño está congelado (prototipo aprobado). Lo único que se agrega es
 * el caso de error y — solo en DEMO — una cajita con las cuentas de prueba,
 * para que quien abra la demo pueda entrar sin preguntarle nada a nadie.
 * Esa cajita desaparece sola cuando `DEMO_MODE=false`.
 *
 * Nota para la migración a SSO (Azure AD): cuando llegue ese momento, este
 * componente se reemplaza por un botón "Continuar con Microsoft" y la pantalla
 * de al lado no cambia nada.
 */
export function FormularioLogin({ demo }: { demo: boolean }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

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

  function usarCuenta(email: string) {
    setUsuario(email);
    setPassword("demo1234");
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
        <input
          className="text-input"
          id="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

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

      {demo && (
        <div className="lg-demo-box">
          <div className="lg-demo-title">Modo demo · cuentas de prueba</div>
          {USUARIOS_DEMO.map((u) => (
            <button
              key={u.id}
              type="button"
              className="lg-demo-user"
              onClick={() => usarCuenta(u.email)}
            >
              <span className="lg-demo-name">{u.email}</span>
              <span className="lg-demo-role">{ROL_LABEL[u.rol]}</span>
            </button>
          ))}
          <p className="nota-demo" style={{ marginTop: 10 }}>
            Contraseña para todas: <span className="mono">demo1234</span>. Haz clic en una cuenta
            para llenar el formulario. Con <span className="mono">Carlos Múnera</span> se ve el
            recorte real de un coordinador.
          </p>
        </div>
      )}
    </>
  );
}
