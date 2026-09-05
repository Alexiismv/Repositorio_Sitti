import { expect, test } from "@playwright/test";
import { loginComo } from "./helpers";

/**
 * Verifica que la navegación visible y el acceso directo por URL coincidan
 * con los perfiles reales de cada cuenta demo (ver src/lib/auth/usuarios-demo.ts
 * y src/lib/auth/modulos.ts — ACCESO_POR_ROL). Es el caso que el propio
 * CLAUDE.md señala como "la forma más rápida de ver que el modelo de permisos
 * funciona de verdad y no es decorativo".
 */

test.describe("Navegación visible por rol", () => {
  test("Gerente (maria.gomez, verPersonas=false): ve Panel/Gerencias/Reportes, NO ve Personas ni Control de acceso", async ({
    page,
  }) => {
    await loginComo(page, "gerente");
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Panel General" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Gerencias" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Reportes" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Personas" })).toHaveCount(0);
    await expect(nav.getByRole("button", { name: "Control de acceso" })).toHaveCount(0);
  });

  test("Coordinador (carlos.munera, verPersonas=true): SÍ ve Personas, no ve Control de acceso", async ({
    page,
  }) => {
    await loginComo(page, "coordinador");
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Personas" })).toBeVisible();
    await expect(nav.getByRole("button", { name: "Control de acceso" })).toHaveCount(0);
  });

  test("Administrador: ve el desplegable 'Control de acceso' con Usuarios y Perfiles", async ({ page }) => {
    await loginComo(page, "administrador");
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await nav.getByRole("button", { name: "Control de acceso" }).hover();
    await expect(page.getByRole("menu").getByRole("link", { name: "Usuarios" })).toBeVisible();
    await expect(page.getByRole("menu").getByRole("link", { name: "Perfiles" })).toBeVisible();
  });
});

test.describe("Acceso directo por URL (defensa en profundidad, no solo ocultar el enlace)", () => {
  test("Gerente sin acceso a Personas entrando por URL directa ve 'Sin acceso', no la pantalla", async ({
    page,
  }) => {
    await loginComo(page, "gerente");
    await page.goto("/personas");
    await expect(page.getByRole("heading", { name: "Sin acceso" })).toBeVisible();
  });

  test("Coordinador entrando a /admin/usuarios por URL directa ve 'Sin acceso'", async ({ page }) => {
    await loginComo(page, "coordinador");
    await page.goto("/admin/usuarios");
    await expect(page.getByRole("heading", { name: "Sin acceso" })).toBeVisible();
  });

  test("Administrador SÍ pasa el gate de pantalla en /admin/usuarios, pero en DEMO_MODE ve el aviso de que requiere Postgres real", async ({
    page,
  }) => {
    await loginComo(page, "administrador");
    await page.goto("/admin/usuarios");
    await expect(page.getByRole("heading", { name: "Sin acceso" })).toHaveCount(0);
    await expect(page.getByText(/no está disponible en modo demo/)).toBeVisible();
  });

  test("sin sesión, cualquier pantalla protegida redirige a /login", async ({ page }) => {
    await page.goto("/reportes");
    await expect(page).toHaveURL(/\/login/);
  });
});
