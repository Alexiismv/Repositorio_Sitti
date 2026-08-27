import { redirect } from "next/navigation";

import { leerSesion } from "@/lib/auth/sesion";
import { DEMO_MODE } from "@/lib/data/provider";

import { FormularioCambiarPassword } from "./formulario";

export const metadata = { title: "Cambiar mi contraseña · SITTI" };

export default async function CambiarPasswordPage() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  return (
    <>
      <div className="sh-page-head">
        <div className="eyebrow">
          <span className="dot" /> Mi cuenta
        </div>
        <h1>Cambiar mi contraseña</h1>
        <p>
          Disponible para cualquier rol — cada quien administra su propia contraseña, sin pasar
          por el Administrador.
        </p>
      </div>

      <div className="panel cp-panel">
        {DEMO_MODE ? (
          <p className="nota-demo">
            En modo demo las tres cuentas de prueba son fijas y no viven en base de datos, así
            que no hay contraseña que cambiar aquí. Esto funciona en cuanto la app corre con
            Postgres conectado (<span className="mono">DEMO_MODE=false</span>).
          </p>
        ) : (
          <FormularioCambiarPassword email={sesion.email} />
        )}
      </div>
    </>
  );
}
