import { redirect } from "next/navigation";

import { SectionLabel } from "@/components/ui";
import { leerSesion } from "@/lib/auth/sesion";
import { ROL_LABEL, veTodo } from "@/lib/auth/tipos";
import { USUARIOS_DEMO } from "@/lib/auth/usuarios-demo";
import { AREAS, SEDES } from "@/lib/catalogo";
import { DEMO_MODE } from "@/lib/data/provider";

export const metadata = { title: "Usuarios · SITTI" };

function describePermisos(permisos: { sede: string; area: string }[]): string {
  if (permisos.some((p) => p.sede === "*" && p.area === "*")) return "Todas las sedes y áreas";

  return permisos
    .map((p) => {
      const sede = p.sede === "*" ? "todas las sedes" : (SEDES.find((s) => s.slug === p.sede)?.nombre ?? p.sede);
      const area = p.area === "*" ? "todas las áreas" : (AREAS.find((a) => a.slug === p.area)?.nombre ?? p.area);
      return `${area} · ${sede}`;
    })
    .join(" — ");
}

/**
 * Gestión de usuarios (solo Administrador).
 *
 * Está en modo lectura a propósito: crear y editar cuentas escribe en
 * `auth.usuarios`, y esa tabla todavía no existe. Mostrar botones que no hacen
 * nada sería peor que decir claramente qué falta — así Alexis sabe exactamente
 * qué queda por conectar.
 */
export default async function UsuariosPage() {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  // Doble barrera: el enlace solo aparece para admin, pero la página también
  // se defiende sola por si alguien escribe la URL a mano.
  if (sesion.rol !== "administrador") {
    return (
      <>
        <div className="sh-page-head">
          <h1>Sin acceso</h1>
          <p>
            La gestión de usuarios es exclusiva del rol Administrador. Tu rol actual es{" "}
            <strong>{ROL_LABEL[sesion.rol]}</strong>.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="sh-page-head">
        <div className="eyebrow">
          <span className="dot" /> Administración
        </div>
        <h1>Usuarios del sistema</h1>
        <p>
          Las cuentas se crean manualmente desde aquí — no hay autoregistro. Cada coordinador se
          configura eligiendo qué sedes ve y, dentro de cada sede, qué áreas.
        </p>
      </div>

      <SectionLabel>Cuentas</SectionLabel>

      <div className="panel">
        <div className="scroll-x">
          <table className="tabla">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre</th>
                <th>Rol</th>
                <th>Alcance de visibilidad</th>
                <th>Ve Personas</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {USUARIOS_DEMO.map((u) => (
                <tr key={u.id}>
                  <td className="mono" style={{ color: "var(--navy)", fontWeight: 600 }}>
                    {u.email}
                  </td>
                  <td>{u.nombre}</td>
                  <td>{ROL_LABEL[u.rol]}</td>
                  <td style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                    {describePermisos(u.permisos)}
                  </td>
                  <td>
                    <span className={`semaforo ${u.rol === "administrador" || u.verPersonas ? "verde" : "rojo"}`} style={{ marginRight: 6 }} />
                    {u.rol === "administrador" || u.verPersonas ? "Sí" : "No"}
                  </td>
                  <td>
                    <span className={`semaforo ${u.activo ? "verde" : "rojo"}`} style={{ marginRight: 6 }} />
                    {u.activo ? "Activo" : "Inactivo"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {DEMO_MODE && (
          <p className="nota-demo">
            En modo demo esta lista es fija y de solo lectura. Crear, editar y desactivar usuarios
            requiere la tabla <span className="mono">auth.usuarios</span> en Postgres — está en{" "}
            <span className="mono">db/schema.sql</span> y el paso a paso en{" "}
            <span className="mono">docs/SETUP-ALEXIS.md</span>.
          </p>
        )}
      </div>

      <SectionLabel>Cómo funciona el modelo de permisos</SectionLabel>

      <div className="grid-2-igual">
        <div className="panel">
          <h4>Gerente</h4>
          <div className="panel-sub">Acceso total</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-soft)", margin: 0 }}>
            Ve todas las gerencias, áreas y sedes. Usa los filtros para enfocarse en una o varias,
            pero nada le está restringido.
          </p>
        </div>
        <div className="panel">
          <h4>Coordinador</h4>
          <div className="panel-sub">Acceso anidado sede → área</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink-soft)", margin: 0 }}>
            La visibilidad de área va <strong>dentro</strong> de la sede: se puede configurar
            &ldquo;Cartera solo en Caribe&rdquo; y &ldquo;Multas solo en Poblado&rdquo; para la
            misma persona. Por eso cada permiso es la pareja (sede, área) y no dos listas sueltas.
          </p>
        </div>
      </div>

      <p className="nota-demo">
        Entra con la cuenta <span className="mono">carlos.munera</span> para ver el efecto real:
        el panel, el mapa y los reportes se recortan solos a lo que tiene asignado
        {veTodo(sesion) ? "" : ""}.
      </p>
    </>
  );
}
