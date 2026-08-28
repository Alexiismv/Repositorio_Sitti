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
import { conCliente } from "@/lib/db";

export interface EventoAuditoria {
  accion: string;
  actor: string;
  detalle?: string;
  /** IP de origen, para poder reconstruir un acceso indebido. */
  ip?: string | null;
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

  console.log(linea);
  if (DEMO_MODE) return;

  /*
   * El INSERT estaba como comentario: `auth.audit_log` existe desde el primer
   * esquema pero nunca se escribió, así que el rastro vivía solo en los logs
   * de Vercel, que en plan Hobby se retienen horas. Sin esto no hay forma de
   * investigar un acceso indebido después de que ocurra.
   *
   * Va en try/catch a propósito: una bitácora caída no puede tumbar un login.
   */
  try {
    await conCliente((cliente) =>
      cliente.query(
        `INSERT INTO auth.audit_log (accion, actor, detalle, ip) VALUES ($1, $2, $3, $4)`,
        [evento.accion, evento.actor, evento.detalle ?? null, evento.ip || null],
      ),
    );
  } catch (e) {
    console.error("[auditoria] no se pudo persistir el evento:", e instanceof Error ? e.message : e);
  }
}

export async function registrarError(evento: EventoError): Promise<void> {
  const linea = `[error] ${new Date().toISOString()} ${evento.origen}: ${evento.mensaje}`;

  console.error(linea, evento.detalle ?? "");
  if (DEMO_MODE) return;

  try {
    await conCliente((cliente) =>
      cliente.query(
        `INSERT INTO auth.error_log (origen, mensaje, detalle) VALUES ($1, $2, $3)`,
        [evento.origen, evento.mensaje, evento.detalle ? JSON.stringify(evento.detalle) : null],
      ),
    );
  } catch (e) {
    console.error("[error] no se pudo persistir el evento:", e instanceof Error ? e.message : e);
  }
}
