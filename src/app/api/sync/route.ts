import { NextResponse } from "next/server";

import { leerSesion } from "@/lib/auth/sesion";
import { puedeUsarAccion } from "@/lib/auth/tipos";
import { DEMO_MODE } from "@/lib/data/provider";
import { hayCredencialesJira } from "@/lib/etl/jira";
import { DIAS_INCREMENTAL, sincronizar, type ModoSync } from "@/lib/etl/sincronizar";
import { registrarAuditoria, registrarError } from "@/lib/logs";

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

  // Sincronizar le pega a un sistema externo y reescribe la tabla que todos
  // ven. Eso se limita a quien tenga la acción "sincronizar" habilitada en
  // Panel General (perfiles Administrador y Gerente la traen por defecto).
  if (!puedeUsarAccion(sesion, "panel-general", "sincronizar")) {
    return NextResponse.json(
      { error: "No tienes permiso para sincronizar con Jira." },
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
      detalle: `modo=${r.modo} tickets=${r.totalTickets} backlog=${r.totalBacklog} ms=${r.duracionMs}`,
    });

    return NextResponse.json({
      ok: true,
      ...r,
      mensaje:
        r.modo === "incremental"
          ? `${r.totalTickets} ticket(s) y ${r.totalBacklog} ítem(s) de backlog con cambios en los últimos ${DIAS_INCREMENTAL} días.`
          : `Recarga completa: ${r.totalTickets} tickets, ${r.totalBacklog} ítems de backlog.`,
    });
  } catch (e) {
    const crudo = e instanceof Error ? e.message : "Error desconocido";

    /*
     * "Ya hay una sincronización en curso" es información útil y sin riesgo,
     * así que se devuelve tal cual. Cualquier otro error se generaliza: el
     * mensaje nativo de `pg` trae el host de Neon (`ep-xxxx.aws.neon.tech`) y
     * el de Jira puede traer nombres de proyecto o detalles de permisos. Nada
     * de eso tiene por qué salir en una respuesta HTTP.
     */
    const esperado = crudo.startsWith("Ya hay una sincronización en curso");
    await registrarError({ origen: "api", mensaje: "Fallo en /api/sync", detalle: crudo });

    return NextResponse.json(
      { error: esperado ? crudo : "No se pudo sincronizar. El detalle quedó en la bitácora." },
      { status: esperado ? 409 : 500 },
    );
  }
}
