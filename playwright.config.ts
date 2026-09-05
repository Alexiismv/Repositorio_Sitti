import { defineConfig, devices } from "@playwright/test";

/**
 * Etapas 3 (E2E multi-rol) y 4 (smoke de producción) de la cascada.
 * Ninguna de las dos levanta servidor: apuntan a un deploy YA existente de
 * Vercel, igual que lo revisas tú a mano hoy.
 *
 * - PLAYWRIGHT_BASE_URL: la URL que HOY tenga DEMO_MODE=true (las pruebas E2E
 *   inician sesión con las 3 cuentas demo). Al momento de escribir esto es
 *   Production (repositorio-sitti.vercel.app, ver CLAUDE.md §7.5 — decisión
 *   TEMPORAL de Alexis para mostrar el mockup) — cuando eso se revierta a
 *   datos reales, esta variable hay que moverla a la URL que quede en modo
 *   demo en ese momento (o a un entorno dedicado si ya no queda ninguna).
 * - PLAYWRIGHT_PROD_URL: la URL con datos reales, para el smoke liviano. Hoy
 *   es "pruebas" (sitti-pruebas.vercel.app, DEMO_MODE=false contra la rama
 *   `desarrollo` de Neon) hasta que Production vuelva a ser la real.
 *
 * Se deja indefinida a propósito si la variable no está puesta: cada proyecto
 * se corre por separado (`--project=e2e` o `--project=smoke`), así que exigir
 * ambas variables siempre rompería la que no se está usando. Sin `baseURL`,
 * Playwright falla con un mensaje propio y claro ("no baseURL set") en el
 * primer `page.goto()` — no hay riesgo de pegarle en silencio a "undefined".
 */
export default defineConfig({
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // e2e y smoke son invocaciones de CLI separadas (--project distinto) que
  // comparten este mismo config — cada una necesita su propio archivo de
  // salida, si no la segunda pisa el reporte de la primera.
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT ?? "reportes-prueba/resultado.json" }]]
    : "list",
  projects: [
    {
      name: "e2e",
      testDir: "./tests/e2e",
      use: { ...devices["Desktop Chrome"], baseURL: process.env.PLAYWRIGHT_BASE_URL },
    },
    {
      name: "smoke",
      testDir: "./tests/smoke",
      use: { ...devices["Desktop Chrome"], baseURL: process.env.PLAYWRIGHT_PROD_URL },
    },
  ],
});
