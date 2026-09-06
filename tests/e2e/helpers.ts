import type { Page } from "@playwright/test";

/** Las 3 cuentas demo documentadas en CLAUDE.md §3. */
export const CUENTAS_DEMO = {
  gerente: { usuario: "maria.gomez", password: "demo1234", nombre: "María Gómez" },
  coordinador: { usuario: "carlos.munera", password: "demo1234", nombre: "Carlos Múnera" },
  administrador: { usuario: "admin", password: "demo1234", nombre: "Administrador SITTI" },
} as const;

export type RolDemo = keyof typeof CUENTAS_DEMO;

export async function loginComo(page: Page, rol: RolDemo) {
  const { usuario, password } = CUENTAS_DEMO[rol];
  await page.goto("/login");
  // exact:true es obligatorio acá: el botón de "Mostrar contraseña" también
  // tiene "contraseña" en su aria-label, así que un match parcial trae 2
  // elementos y Playwright lanza en modo estricto.
  await page.getByLabel("Usuario", { exact: true }).fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}
