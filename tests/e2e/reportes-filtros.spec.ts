import { expect, test } from "@playwright/test";
import { loginComo } from "./helpers";

/**
 * Regla dura de CLAUDE.md §2.1 punto 6: Área es hija de Gerencia. El listado
 * de Área ofrecido en /reportes SIEMPRE se filtra por la Gerencia elegida, y
 * si se cambia de Gerencia, cualquier Área ya marcada que ya no pertenezca se
 * destilda sola. Esto es lo que evita un filtro imposible tipo
 * Gerencia="Operación Contravencional" + Área="Radicación" (que es de Jurídica).
 */
test.describe("/reportes — blindaje Gerencia → Área", () => {
  test("elegir una Gerencia filtra las Áreas ofrecidas a solo las suyas", async ({ page }) => {
    await loginComo(page, "gerente");
    await page.goto("/reportes");

    await page.getByLabel("Gerencia").selectOption({ label: "Jurídica" });
    await page.locator("#f-area-btn").click();

    const checklist = page.getByRole("listbox");
    await expect(checklist.getByText("Radicación")).toBeVisible();
    await expect(checklist.getByText("CAD", { exact: true })).toBeVisible();
    // "Cartera" es de Financiera, nunca debe ofrecerse con Gerencia=Jurídica.
    await expect(checklist.getByText("Cartera", { exact: true })).toHaveCount(0);
  });

  test("cambiar de Gerencia destilda las Áreas que ya no pertenecen (blindaje real, no solo visual)", async ({
    page,
  }) => {
    await loginComo(page, "gerente");
    await page.goto("/reportes");

    await page.getByLabel("Gerencia").selectOption({ label: "Jurídica" });
    await page.locator("#f-area-btn").click();
    await page.getByRole("listbox").getByText("Radicación").click();
    await expect(page.locator("#f-area-btn")).toContainText("Radicación");

    // Cambiar a otra gerencia: "Radicación" ya no pertenece, debe destildarse sola.
    await page.getByLabel("Gerencia").selectOption({ label: "Financiera" });
    await expect(page.locator("#f-area-btn")).toContainText("Todas");
  });

  test("con Gerencia='Todas' (sin elegir), se ofrecen las 24 áreas del catálogo completo", async ({ page }) => {
    await loginComo(page, "gerente");
    await page.goto("/reportes");
    await page.locator("#f-area-btn").click();
    const opciones = page.getByRole("listbox").locator(".filtro-checklist-item");
    // 24 áreas + la opción "Todas" = 25.
    await expect(opciones).toHaveCount(25);
  });
});
