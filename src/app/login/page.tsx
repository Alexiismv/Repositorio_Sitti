import Image from "next/image";
import { redirect } from "next/navigation";

import { leerSesion } from "@/lib/auth/sesion";
import { DEMO_MODE } from "@/lib/data/provider";
import { GERENCIAS } from "@/lib/catalogo";

import { USUARIOS_DEMO } from "@/lib/auth/usuarios-demo";
import { PieCopyright } from "@/components/pie-copyright";

import { FormularioLogin, type CuentaDemo } from "./formulario";
import "./login.css";

export const metadata = { title: "Ingresar · SITTI" };

/*
 * Las cuentas de prueba se arman EN EL SERVIDOR y solo si el modo demo está
 * activo. Antes el formulario las importaba directamente y, por ser un
 * componente de cliente, el array viajaba al navegador siempre — contraseña
 * incluida — aunque la cajita no se pintara. Si esto devuelve `undefined`, no
 * queda ni rastro en el bundle ni en el HTML.
 */
function cuentasDemo(): CuentaDemo[] | undefined {
  if (!DEMO_MODE) return undefined;
  return USUARIOS_DEMO.map((u) => ({ email: u.email, rol: u.rol, password: u.password }));
}

export default async function LoginPage() {
  // Si ya hay sesión válida, no tiene sentido volver a pedir credenciales.
  if (await leerSesion()) redirect("/");

  // El ticker duplica la lista para que el scroll infinito no muestre el corte.
  const ticker = [...GERENCIAS, ...GERENCIAS].filter((g) => g.slug !== "sin-gerencia");

  return (
    <div className="lg-wrap">
      <div className="lg-brand">
        <div className="lg-mark">
          <span className="lg-dot" />
          SOMOS SITTI
        </div>

        <div className="lg-radar" aria-hidden="true">
          <svg viewBox="0 0 560 560">
            <circle className="lg-ring lg-ring-faint" cx="280" cy="280" r="230" />
            <circle className="lg-ring lg-ring-faint" cx="280" cy="280" r="170" />
            <g className="lg-spin-slow">
              <path className="lg-ring lg-ring-gold" d="M 280 50 A 230 230 0 0 1 490 210" />
            </g>
            <g className="lg-spin-slow-rev">
              <path className="lg-ring lg-ring-teal" d="M 100 350 A 230 230 0 0 0 300 508" />
            </g>
            <g className="lg-spin-mid">
              <path className="lg-ring lg-ring-orange" d="M 200 130 A 170 170 0 0 1 440 260" />
            </g>
            <circle className="lg-pulse-dot" cx="280" cy="280" r="4" fill="#EC623B" />
          </svg>
        </div>

        <div className="lg-copy">
          <span className="lg-eyebrow">Panel de Gestión</span>
          <h1>Nos mueve MEDELLÍN</h1>
          <p>
            Indicadores de gestión conectados a la operación diaria — para decidir con datos, no con
            suposiciones.
          </p>
        </div>

        <div className="lg-ticker-wrap">
          <div className="lg-ticker" aria-hidden="true">
            {ticker.map((g, i) => (
              <span key={`${g.slug}-${i}`}>{g.nombre}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="lg-form-panel">
        <div className="lg-card">
          <div className="lg-logo">
            <Image src="/logo-sitti.png" alt="SITTI" width={190} height={38} style={{ height: "auto", width: 190 }} priority />
          </div>

          <h2 className="h-display">Inicia sesión</h2>
          <p className="lg-sub">Accede con tu usuario para ver los indicadores de tu gerencia.</p>

          <FormularioLogin cuentasDemo={cuentasDemo()} />

          <p className="lg-helper">
            ¿Problemas para entrar? <a href="#">Contacta a Mesa de Ayuda SITTI</a>.
          </p>

          <div className="lg-footer">
            <p style={{ margin: 0 }}>SITTI · Panel de Gestión · Secretaría de Movilidad de Medellín</p>
            <PieCopyright />
          </div>
        </div>
      </div>
    </div>
  );
}
