import { defineConfig } from "@playwright/test";

/**
 * Etapa 2 de la cascada: pruebas de integración contra las rutas API reales
 * (`src/app/api/**`), corriendo el propio servidor Next en DEMO_MODE=true.
 * No toca Postgres — el dataset demo es determinístico, así que estas pruebas
 * corren igual en tu máquina y en CI sin ninguna credencial.
 */
export default defineConfig({
  testDir: "./tests/integration",
  fullyParallel: false, // /api/sync tiene candado de concurrencia — correr en serie evita falsos negativos.
  // Pocos workers: `next dev` compila cada ruta la primera vez que la pisa una
  // request (a diferencia de `next start`, que no sirve porque fuerza
  // producción y apaga DEMO_MODE) — mucha concurrencia contra un servidor en
  // frío genera lentitud/flakiness que no es un bug de la app.
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "reportes-prueba/integracion.json" }]]
    : "list",
  use: {
    baseURL: "http://localhost:3199",
    extraHTTPHeaders: { "Content-Type": "application/json" },
  },
  webServer: {
    // Puerto dedicado (no el 3100 de `npm run dev`) para que esta suite NUNCA
    // reutilice por accidente un servidor ajeno que ya esté corriendo en tu
    // máquina (por ejemplo, uno en producción con `next start` que dejaste
    // abierto para revisar algo) — eso pasó una vez armando esta suite: el
    // login probaba contra Postgres real en vez del dataset demo.
    command: "npx next dev -p 3199",
    url: "http://localhost:3199/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DEMO_MODE: "true" },
  },
});
