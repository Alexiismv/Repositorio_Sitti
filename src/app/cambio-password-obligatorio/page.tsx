import { redirect } from "next/navigation";

import { leerSesionPendiente } from "@/lib/auth/sesion";

import { FormularioCambioObligatorio } from "./formulario";
import "../(panel)/cambiar-password/cambiar-password.css";
import "./pagina.css";

export const metadata = { title: "Cambio de contraseña obligatorio · SITTI" };

/**
 * Spec 1.3 punto 4: tras un restablecimiento de contraseña por el
 * administrador, el siguiente login con la contraseña por defecto ("admin")
 * cae acá — antes de dar acceso al sistema, exige definir una contraseña
 * nueva. No pide la contraseña actual: ya se demostró identidad al loguearse
 * con la que dejó el administrador; pedirla de nuevo es fricción sin
 * seguridad adicional real.
 */
export default async function CambioPasswordObligatorioPage() {
  const pendiente = await leerSesionPendiente();
  if (!pendiente) redirect("/login");

  return (
    <div className="cpo-wrap">
      <div className="panel cp-panel cpo-panel">
        <div className="eyebrow">
          <span className="dot" /> Seguridad de la cuenta
        </div>
        <h1>Cambio de contraseña obligatorio</h1>
        <p>
          Un administrador restableció tu contraseña. Antes de continuar, define una contraseña
          nueva para <strong>{pendiente.email}</strong>.
        </p>
        <FormularioCambioObligatorio />
      </div>
    </div>
  );
}
