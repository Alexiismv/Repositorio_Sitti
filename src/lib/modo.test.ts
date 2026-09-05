import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `DEMO_MODE` es una constante calculada UNA VEZ al importar el módulo, a partir
 * de `process.env`. Para probar cada combinación hay que resetear el registro de
 * módulos y reimportar después de fijar las variables — si no, Vitest reutiliza
 * el primer resultado calculado y todos los casos de aquí en adelante mienten.
 */
async function demoModeCon(env: Record<string, string | undefined>) {
  vi.resetModules();
  const original = { ...process.env };
  Object.assign(process.env, env);
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
  }
  const { DEMO_MODE } = await import("@/lib/modo");
  process.env = original;
  return DEMO_MODE;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("regresión: bug de producción del 27 ago 2026 (CLAUDE.md §7.3)", () => {
  it("DEMO_MODE='' (cadena vacía) NO desactiva el modo demo — así se coló el bug en Vercel", async () => {
    const resultado = await demoModeCon({
      NODE_ENV: "development",
      VERCEL_ENV: undefined,
      DEMO_MODE: "",
    });
    expect(resultado).toBe(true);
  });

  it("solo la cadena EXACTA 'false' desactiva el modo demo fuera de producción", async () => {
    const resultado = await demoModeCon({
      NODE_ENV: "development",
      VERCEL_ENV: undefined,
      DEMO_MODE: "false",
    });
    expect(resultado).toBe(false);
  });

  it("variantes cercanas a 'false' (mayúsculas, espacios) NO cuentan como 'false'", async () => {
    for (const valor of ["False", "FALSE", " false", "false ", "0"]) {
      const resultado = await demoModeCon({
        NODE_ENV: "development",
        VERCEL_ENV: undefined,
        DEMO_MODE: valor,
      });
      expect(resultado, `DEMO_MODE="${valor}" no debería desactivar el modo demo`).toBe(true);
    }
  });
});

describe("guarda de producción (independiente de la variable DEMO_MODE)", () => {
  it("en producción (NODE_ENV=production) el modo demo está SIEMPRE apagado, aunque falte DEMO_MODE", async () => {
    const resultado = await demoModeCon({
      NODE_ENV: "production",
      VERCEL_ENV: undefined,
      DEMO_MODE: undefined,
    });
    expect(resultado).toBe(false);
  });

  it("estar en Vercel (VERCEL_ENV presente) también cuenta como producción, sin importar su valor", async () => {
    const resultado = await demoModeCon({
      NODE_ENV: "development",
      VERCEL_ENV: "preview",
      DEMO_MODE: "true",
    });
    expect(resultado).toBe(false);
  });

  it("sin ninguna variable de entorno (desarrollo local típico), el modo demo queda activo", async () => {
    const resultado = await demoModeCon({
      NODE_ENV: "development",
      VERCEL_ENV: undefined,
      DEMO_MODE: undefined,
    });
    expect(resultado).toBe(true);
  });
});
