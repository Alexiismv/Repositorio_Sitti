import { expect, test } from "@playwright/test";

/**
 * Etapa 4 de la cascada — smoke post-deploy contra PRODUCCIÓN real
 * (PLAYWRIGHT_PROD_URL). A propósito NO usa credenciales (no hay cuentas demo
 * en producción — DEMO_MODE es siempre false ahí, ver src/lib/modo.ts) y NO
 * llama nada que mute estado real: nada de /api/sync, nada de login con una
 * cuenta real, nada de exportar. Solo confirma que el deploy está vivo y no
 * quedó roto de forma silenciosa (el mismo tipo de fallo que documenta
 * CLAUDE.md §7.3: build verde pero login real caído en producción).
 */

test.describe("Smoke de producción — no destructivo, sin credenciales", () => {
  test("/login responde 200 y renderiza el formulario", async ({ page }) => {
    const respuesta = await page.goto("/login");
    expect(respuesta?.status()).toBe(200);
    await expect(page.getByLabel("Usuario", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  });

  test("sin sesión, la raíz redirige a /login (no expone datos)", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login con credenciales inválidas responde 401, nunca 500 (confirma que el backend real está respondiendo, no solo el HTML estático)", async ({
    request,
  }) => {
    const res = await request.post("/api/auth/login", {
      data: { usuario: "smoke-test-no-existe", password: "no-existe" },
    });
    expect(res.status()).toBe(401);
  });

  test("las cabeceras de seguridad esperadas están presentes", async ({ page }) => {
    const respuesta = await page.goto("/login");
    const headers = respuesta?.headers() ?? {};
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
  });

  test("no hay errores de consola al cargar /login (detecta bundles rotos post-deploy)", async ({ page }) => {
    // Vercel inyecta su propio widget de feedback (vercel.live) en Preview y
    // Production, ajeno al bundle de la app — dispara una violación de CSP
    // report-only ("Framing '...vercel.live/'...") y, como consecuencia, un
    // "Failed to load resource: ...400" genérico para ese mismo iframe
    // bloqueado (Chrome no incluye la URL en este segundo mensaje). Ninguno
    // de los dos tiene que ver con si el deploy de la app quedó roto.
    // Confirmado en CI (run 33999851511, 5 sep 2026): sin este filtro, el
    // smoke fallaba en un deploy sano.
    const RUIDO_CONOCIDO = [/vercel\.live/i, /^Failed to load resource: the server responded with a status of \d+/];
    const errores: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !RUIDO_CONOCIDO.some((r) => r.test(msg.text()))) {
        errores.push(msg.text());
      }
    });
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    expect(errores, `errores de consola encontrados: ${errores.join(" | ")}`).toEqual([]);
  });
});
