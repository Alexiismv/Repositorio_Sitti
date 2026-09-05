import { expect, test } from "@playwright/test";
import { CUENTAS_DEMO, loginComo } from "./helpers";

/**
 * Etapa 3 de la cascada — E2E multi-rol contra un Preview Deployment real
 * (PLAYWRIGHT_BASE_URL). El diseño de /login está congelado (CLAUDE.md §2.3):
 * estas pruebas verifican comportamiento, no lo tocan visualmente.
 */

test.describe("Login", () => {
  test("credenciales incorrectas muestran el error en pantalla, sin navegar", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Usuario").fill("no-existe");
    await page.getByLabel("Contraseña").fill("loquesea");
    await page.getByRole("button", { name: "Ingresar" }).click();

    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  for (const rol of Object.keys(CUENTAS_DEMO) as (keyof typeof CUENTAS_DEMO)[]) {
    test(`la cuenta demo de ${rol} (${CUENTAS_DEMO[rol].usuario}) entra y ve su nombre en la barra superior`, async ({
      page,
    }) => {
      await loginComo(page, rol);
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByText(CUENTAS_DEMO[rol].nombre)).toBeVisible();
    });
  }

  test("con sesión activa, visitar /login redirige de vuelta a la app", async ({ page }) => {
    await loginComo(page, "gerente");
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
  });

  test("cerrar sesión vuelve a pedir login al intentar entrar de nuevo", async ({ page }) => {
    await loginComo(page, "administrador");
    await page.getByRole("button", { name: /Administrador SITTI/ }).click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});
