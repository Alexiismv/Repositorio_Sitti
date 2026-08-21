import { NextResponse } from "next/server";

import { leerSesion } from "@/lib/auth/sesion";
import { DEMO_MODE } from "@/lib/data/provider";
import { hayCredencialesJira } from "@/lib/etl/jira";
import { DIAS_INCREMENTAL, sincronizar, type ModoSync } from "@/lib/etl/sincronizar";
import { registrarAuditoria } from "@/lib/logs";

/**
 * Endpoint del botón "Refrescar" del panel.
 *
 * Trae de Jira lo que cambió en los últimos días y lo actualiza en la base.
 * Existe para que nadie tenga que esperar a la sincronización programada
 * cuando va a entrar a una reunión y quiere el dato de hoy.
 *
 * Está en Vercel y no en un cron porque en el plan Hobby los cron jobs solo
 * corren una vez al día y con hasta 59 minutos de imprecisión — inservible
 * para "dame el dato ahora". La sincronización automática 2x/día vive en
 * GitHub Actions (gratis); esto es la vía manual.
 */

// Hobby permite hasta 300 s por invocación. El modo incremental termina en
// segundos; el margen está para el día que alguien pida un reload completo.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const sesion = await leerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // Un coordinador consulta; sincronizar le pega a un sistema externo y
  // reescribe la tabla que todos ven. Eso se limita a quien tiene alcance total.
  if (sesion.rol !== "gerente" && sesion.rol !== "administrador") {
    return NextResponse.json(
      { error: "Solo un Gerente o el Administrador pueden sincronizar." },
      { status: 403 },
    );
  }

  if (DEMO_MODE) {
    return NextResponse.json({
      ok: false,
      demo: true,
      mensaje:
        "Estás en modo demo: los datos se generan localmente, no hay nada que traer de Jira. " +
        "El botón funcionará cuando la app esté conectada (DEMO_MODE=false).",
    });
  }

  if (!hayCredencialesJira()) {
    return NextResponse.json(
      {
        error:
          "Faltan las credenciales de Jira en las variables de entorno. Ver CLAUDE.md § 5.1.",
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  // El modo completo se puede pedir explícitamente, pero el default es el
  // incremental: es lo que hace que el botón responda en segundos.
  const modo: ModoSync = url.searchParams.get("modo") === "completo" ? "completo" : "incremental";

  try {
    const r = await sincronizar({ modo });

    await registrarAuditoria({
      accion: "sync_manual",
      actor: sesion.email,
      detalle: `modo=${r.modo} tickets=${r.totalTickets} ms=${r.duracionMs}`,
    });

    return NextResponse.json({
      ok: true,
      ...r,
      mensaje:
        r.modo === "incremental"
          ? `${r.totalTickets} ticket(s) con cambios en los últimos ${DIAS_INCREMENTAL} días.`
          : `Recarga completa: ${r.totalTickets} tickets.`,
    });
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : "Error desconocido";
    // El detalle ya quedó en `auth.error_log` dentro de `sincronizar()`.
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
