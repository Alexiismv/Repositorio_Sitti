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
  await page.getByLabel("Usuario").fill(usuario);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}
