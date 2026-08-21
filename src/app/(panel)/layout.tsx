import { redirect } from "next/navigation";

import { Topbar } from "@/components/topbar";
import { leerSesion } from "@/lib/auth/sesion";
import { DEMO_MODE, ultimaSincronizacion } from "@/lib/data/provider";
import { formatearFechaCorta } from "@/lib/formato";

import "@/components/shell.css";

/**
 * Marco de todas las pantallas autenticadas.
 *
 * La sesión se vuelve a leer acá aunque el middleware ya la haya validado:
 * el middleware es UX + primera barrera, esto es lo que realmente decide si
 * se renderizan datos.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const sesion = await leerSesion();
  if (!sesion) redirect("/login");

  const sync = await ultimaSincronizacion();

  return (
    <>
      <Topbar sesion={sesion} ultimaSync={formatearFechaCorta(sync.fecha)} />
      <main className="sh-main">
        {DEMO_MODE && (
          <div className="sh-aviso-demo">
            <span aria-hidden="true">●</span>
            <span>
              <strong>Modo demo.</strong> Los {sync.total.toLocaleString("es-CO")} tickets que ves
              son generados localmente a partir de los volúmenes 2026 confirmados por área — sirven
              para validar el diseño y los cálculos, no son datos reales de Jira. Al conectar la API
              y la base, esta franja desaparece sola.
            </span>
          </div>
        )}
        {children}
      </main>
    </>
  );
}
