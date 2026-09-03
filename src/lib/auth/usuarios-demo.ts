import { ACCESO_PERSONAS, ACCESO_POR_ROL, accesoTotal, unirAccesos } from "@/lib/auth/modulos";
import type { Sesion, Usuario } from "@/lib/auth/tipos";

/**
 * Usuarios de DEMO.
 *
 * ⚠️ Existen SOLO mientras `DEMO_MODE=true`. No son cuentas reales, no hay
 * password hasheado acá y no se pueden usar en producción: cuando Alexis
 * conecte Postgres, las cuentas viven en `auth.usuarios` con hash bcrypt y
 * este archivo deja de consultarse (ver `src/lib/auth/sesion.ts`).
 *
 * Sirven para mostrar los tres roles y, sobre todo, para que se vea la
 * diferencia real entre "Gerente ve todo" y "Coordinador ve solo lo suyo".
 */

export interface UsuarioDemo extends Usuario {
  /** Contraseña en texto plano — a propósito, es una demo local sin datos reales. */
  password: string;
}

export const USUARIOS_DEMO: UsuarioDemo[] = [
  {
    id: "u-001",
    email: "maria.gomez",
    password: "demo1234",
    nombre: "María Gómez",
    rol: "gerente",
    activo: true,
    permisos: [{ sede: "*", area: "*" }],
    // Placeholder de demo: no representa a la gerente de Conexión de Soluciones.
    // Cámbialo a `true` en este archivo si quieres probar Personas con esta cuenta.
    verPersonas: false,
  },
  {
    id: "u-002",
    email: "carlos.munera",
    password: "demo1234",
    nombre: "Carlos Múnera",
    rol: "coordinador",
    activo: true,
    // Coordinador de Cartera y Financiera, únicamente en Caribe y Centro de Servicios.
    permisos: [
      { sede: "caribe", area: "cartera" },
      { sede: "caribe", area: "financiera" },
      { sede: "centro-de-servicios", area: "cartera" },
    ],
    // Placeholder de demo: se deja en `true` para poder probar el acceso a
    // Personas end-to-end. No representa al coordinador real de Conexión de
    // Soluciones — cuando existan las cuentas reales, este permiso se asigna
    // por usuario desde Gestión de usuarios (hoy de solo lectura en demo).
    verPersonas: true,
  },
  {
    id: "u-003",
    email: "admin",
    password: "demo1234",
    nombre: "Administrador SITTI",
    rol: "administrador",
    activo: true,
    permisos: [{ sede: "*", area: "*" }],
    verPersonas: true,
  },
];

export function buscarUsuarioDemo(usuario: string, password: string): UsuarioDemo | null {
  const encontrado = USUARIOS_DEMO.find(
    (u) => u.email.toLowerCase() === usuario.trim().toLowerCase(),
  );
  if (!encontrado || !encontrado.activo) return null;
  return encontrado.password === password ? encontrado : null;
}

/**
 * Traduce una cuenta demo al nuevo formato de `Sesion` (Fase 4: pantallas por
 * perfil, no por `rol`). Las cuentas demo no viven en Postgres y por lo tanto
 * no tienen perfiles reales que consultar — se les da el mismo acceso
 * "puente" que `scripts/apply-schema.ts` siembra para Gerente/Coordinador
 * (fuente única: `ACCESO_POR_ROL` en `src/lib/auth/modulos.ts`), y el
 * administrador demo recibe acceso total igual que el perfil "Administrador"
 * real. `verPersonas` se traduce sumando `ACCESO_PERSONAS`, igual que la
 * migración hace con las cuentas reales que tenían ese flag.
 */
export function sesionDesdeUsuarioDemo(u: UsuarioDemo): Omit<Sesion, "sub" | "email" | "nombre" | "permisos"> {
  const base = u.rol === "administrador" ? accesoTotal() : ACCESO_POR_ROL[u.rol];
  const { pantallas, acciones, widgets } = u.verPersonas ? unirAccesos(base, ACCESO_PERSONAS) : base;

  return {
    perfiles: [u.rol],
    pantallas,
    acciones,
    widgets,
  };
}
