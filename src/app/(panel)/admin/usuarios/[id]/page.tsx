import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionLabel } from "@/components/ui";
import { listarPerfiles } from "@/lib/auth/perfiles-servicio";
import { leerSesion } from "@/lib/auth/sesion";
import { puedeVerPantalla } from "@/lib/auth/tipos";
import { obtenerUsuario } from "@/lib/auth/usuarios-servicio";
import { SEDES } from "@/lib/catalogo";
import { DEMO_MODE } from "@/lib/data/provider";

import { FormularioUsuario } from "./formulario";

export const metadata = { title: "Usuario · SITTI" };

export default async function UsuarioFormPage({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  if (!puedeVerPantalla(sesion, "admin-usuarios")) {
    return (
      <div className="sh-page-head">
        <h1>Sin acceso</h1>
        <p>
          La administración de usuarios requiere un permiso que no tienes asignado. Pídeselo a un
          administrador.
        </p>
      </div>
    );
  }

  if (DEMO_MODE) {
    return (
      <div className="sh-page-head">
        <h1>No disponible en modo demo</h1>
        <p className="nota-demo">
          La administración de usuarios requiere Postgres real. Ver <span className="mono">CLAUDE.md § 4</span>.
        </p>
      </div>
    );
  }

  const { id } = await params;
  const esNuevo = id === "nuevo";
  const [usuario, perfiles] = await Promise.all([
    esNuevo ? Promise.resolve(null) : obtenerUsuario(id),
    listarPerfiles({ activo: true }),
  ]);

  if (!esNuevo && !usuario) {
    return (
      <div className="sh-page-head">
        <h1>Usuario no encontrado</h1>
        <p>
          <Link href="/admin/usuarios">← Volver a Administración de usuarios</Link>
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
        <h1>{esNuevo ? "Agregar usuario" : `Editar usuario — ${usuario!.nombres}`}</h1>
        <p>
          <Link href="/admin/usuarios">← Volver a Administración de usuarios</Link>
        </p>
      </div>

      <SectionLabel>Usuario sistema</SectionLabel>

      <FormularioUsuario usuario={usuario} perfiles={perfiles} sedes={SEDES} />
    </>
  );
}
