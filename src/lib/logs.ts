/**
 * Dos bitácoras separadas — confirmado en la sección 3 del doc.
 *
 * Son tablas distintas a propósito, porque tienen propósitos y públicos distintos:
 *  - `auditoria`: quién hizo qué y cuándo (accesos, cambios de usuario, exportaciones).
 *    Público: gerencia / cumplimiento.
 *  - `error`: fallas técnicas (sync caído, API de Jira con error, excepciones).
 *    Público: soporte / quien mantiene la app.
 *
 * Mezclarlas haría que el ruido técnico tape el rastro de auditoría, que es
 * justo lo que se necesita conservar limpio.
 *
 * En DEMO escriben a consola. Con base real, un INSERT a `auth.audit_log`
 * y `auth.error_log` (ver `db/schema.sql`).
 */

import { DEMO_MODE } from "@/lib/data/provider";

export interface EventoAuditoria {
  accion: string;
  actor: string;
  detalle?: string;
}

export interface EventoError {
  origen: string;
  mensaje: string;
  detalle?: unknown;
}

export async function registrarAuditoria(evento: EventoAuditoria): Promise<void> {
  const linea = `[auditoria] ${new Date().toISOString()} ${evento.accion} actor=${evento.actor}${
    evento.detalle ? ` ${evento.detalle}` : ""
  }`;

  if (DEMO_MODE) {
    console.log(linea);
    return;
  }
  // INSERT INTO auth.audit_log (ocurrido_en, accion, actor, detalle) VALUES (...)
  console.log(linea);
}

export async function registrarError(evento: EventoError): Promise<void> {
  const linea = `[error] ${new Date().toISOString()} ${evento.origen}: ${evento.mensaje}`;

  if (DEMO_MODE) {
    console.error(linea, evento.detalle ?? "");
    return;
  }
  // INSERT INTO auth.error_log (ocurrido_en, origen, mensaje, detalle) VALUES (...)
  console.error(linea, evento.detalle ?? "");
}
