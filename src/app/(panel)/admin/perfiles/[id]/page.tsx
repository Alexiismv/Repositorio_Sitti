import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionLabel } from "@/components/ui";
import { obtenerPerfil } from "@/lib/auth/perfiles-servicio";
import { leerSesion } from "@/lib/auth/sesion";
import { ROL_LABEL } from "@/lib/auth/tipos";
import { DEMO_MODE } from "@/lib/data/provider";

import { FormularioPerfil } from "./formulario";

export const metadata = { title: "Perfil · SITTI" };

export default async function PerfilFormPage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  if (sesion.rol !== "administrador") {
    return (
      <div className="sh-page-head">
        <h1>Sin acceso</h1>
        <p>
          La gestión de perfiles es exclusiva del rol Administrador. Tu rol actual es{" "}
          <strong>{ROL_LABEL[sesion.rol]}</strong>.
        </p>
      </div>
    );
  }

  if (DEMO_MODE) {
    return (
      <div className="sh-page-head">
        <h1>No disponible en modo demo</h1>
        <p className="nota-demo">
          La gestión de perfiles requiere Postgres real. Ver <span className="mono">CLAUDE.md § 4</span>.
        </p>
      </div>
    );
  }

  const { id } = await params;
  const esNuevo = id === "nuevo";
  const perfil = esNuevo ? null : await obtenerPerfil(id);

  if (!esNuevo && !perfil) {
    return (
      <div className="sh-page-head">
        <h1>Perfil no encontrado</h1>
        <p>
          <Link href="/admin/perfiles">← Volver a Gestión de perfiles</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="sh-page-head">
        <div className="eyebrow">
          <span className="dot" /> Administración
        </div>
        <h1>{esNuevo ? "Agregar perfil" : `Editar perfil — ${perfil!.nombre}`}</h1>
        <p>
          <Link href="/admin/perfiles">← Volver a Gestión de perfiles</Link>
        </p>
      </div>

      <SectionLabel>Datos del perfil</SectionLabel>

      <FormularioPerfil perfil={perfil} />
    </>
  );
}
