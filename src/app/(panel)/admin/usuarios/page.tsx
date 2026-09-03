import Link from "next/link";
import { redirect } from "next/navigation";

import { SectionLabel } from "@/components/ui";
import { listarPerfiles } from "@/lib/auth/perfiles-servicio";
import { leerSesion } from "@/lib/auth/sesion";
import { puedeVerPantalla } from "@/lib/auth/tipos";
import { listarUsuarios, type CampoOrden } from "@/lib/auth/usuarios-servicio";
import { SEDES } from "@/lib/catalogo";
import { DEMO_MODE } from "@/lib/data/provider";

import { FiltrosUsuarios } from "./filtros";
import { TablaUsuarios } from "./tabla";

export const metadata = { title: "Usuarios · SITTI" };

const CAMPOS_ORDEN: CampoOrden[] = ["nombre", "email", "cargo"];

/**
 * Administración de usuarios (spec 1). Reemplaza el mockup de solo lectura
 * (`USUARIOS_DEMO`) por datos reales de `auth.usuarios`. Gate por la
 * pantalla `admin-usuarios`, habilitada según los perfiles del usuario.
 */
export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  const cabecera = (
    <div className="sh-page-head">
      <div className="eyebrow">
        <span className="dot" /> Administración
      </div>
      <h1>Administración de usuarios</h1>
      <p>Las cuentas se crean manualmente desde aquí — no hay autoregistro.</p>
    </div>
  );

  if (DEMO_MODE) {
    return (
      <>
        {cabecera}
        <div className="panel">
          <p className="nota-demo" style={{ marginTop: 0 }}>
            La administración de usuarios requiere la base de datos real (<span className="mono">auth.usuarios</span>{" "}
            en Postgres) y no está disponible en modo demo. Ver <span className="mono">CLAUDE.md § 4</span>.
          </p>
        </div>
      </>
    );
  }

  const sp = await searchParams;
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const q = uno(sp.q) ?? "";
  const activo = uno(sp.activo) ?? "";
  const perfil = uno(sp.perfil) ?? "";
  const sede = uno(sp.sede) ?? "";
  const ordenParam = uno(sp.orden);
  const orden: CampoOrden = CAMPOS_ORDEN.includes(ordenParam as CampoOrden) ? (ordenParam as CampoOrden) : "nombre";
  const dir = uno(sp.dir) === "desc" ? "desc" : "asc";
  const pagina = Number(uno(sp.pagina)) || 1;
  const porPagina = Number(uno(sp.porPagina)) || 10;

  const [{ usuarios, total }, perfiles] = await Promise.all([
    listarUsuarios({
      texto: q || undefined,
      activo: activo === "si" ? true : activo === "no" ? false : undefined,
      perfilId: perfil || undefined,
      sedeSlug: sede || undefined,
      ordenPor: orden,
      ordenDir: dir,
      pagina,
      tamanoPagina: porPagina,
    }),
    listarPerfiles(),
  ]);

  return (
    <>
      {cabecera}

      <SectionLabel>Usuarios</SectionLabel>

      <FiltrosUsuarios perfiles={perfiles} sedes={SEDES} />

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Link href="/admin/usuarios/nuevo" className="btn-primario" style={{ textDecoration: "none" }}>
          + Agregar usuario
        </Link>
      </div>

      <TablaUsuarios
        usuarios={usuarios}
        total={total}
        pagina={pagina}
        porPagina={porPagina}
        orden={orden}
        dir={dir}
        perfiles={perfiles}
      />
    </>
  );
}
