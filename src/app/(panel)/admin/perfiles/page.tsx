import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionLabel } from "@/components/ui";
import { listarPerfiles } from "@/lib/auth/perfiles-servicio";
import { leerSesion } from "@/lib/auth/sesion";
import { puedeVerPantalla } from "@/lib/auth/tipos";
import { DEMO_MODE } from "@/lib/data/provider";

import { TablaPerfiles } from "./tabla";

export const metadata = { title: "Gestión de perfiles · SITTI" };

/** Listado de perfiles (spec 3.2). Gate por la pantalla `admin-perfiles`. */
export default async function PerfilesPage() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  if (!puedeVerPantalla(sesion, "admin-perfiles")) {
    return (
      <div className="sh-page-head">
        <h1>Sin acceso</h1>
        <p>
          La gestión de perfiles requiere un permiso que no tienes asignado. Pídeselo a un
          administrador.
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
        <h1>Gestión de perfiles</h1>
        <p>
          Cada perfil define qué pantallas, botones y gráficos puede usar quien lo tenga asignado. El
          perfil <strong>Administrador</strong> tiene acceso total y no se puede editar ni eliminar.
        </p>
      </div>

      <SectionLabel>Perfiles</SectionLabel>

      {DEMO_MODE ? (
        <div className="panel">
          <p className="nota-demo" style={{ marginTop: 0 }}>
            La gestión de perfiles requiere la base de datos real (<span className="mono">auth.perfiles</span>{" "}
            en Postgres) y no está disponible en modo demo. Ver <span className="mono">CLAUDE.md § 4</span>.
          </p>
        </div>
      ) : (
        <PerfilesConDatos />
      )}
    </>
  );
}

async function PerfilesConDatos() {
  const perfiles = await listarPerfiles();

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Link href="/admin/perfiles/nuevo" className="btn-primario" style={{ textDecoration: "none" }}>
          + Agregar perfil
        </Link>
      </div>
      <TablaPerfiles perfiles={perfiles} />
    </>
  );
}
