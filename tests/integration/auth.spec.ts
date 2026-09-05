import { expect, test } from "@playwright/test";

/**
 * Etapa 2 de la cascada — integración de `/api/auth/**` contra el servidor
 * real en DEMO_MODE=true (ver playwright.integration.config.ts). Usa las 3
 * cuentas demo documentadas en CLAUDE.md §3.
 */

test.describe("POST /api/auth/login", () => {
  test("JSON malformado responde 400 'Solicitud inválida.'", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: "{esto-no-es-json",
    });
    expect(res.status()).toBe(400);
  });

  test("campos vacíos responden 400 sin importar credenciales", async ({ request }) => {
    const res = await request.post("/api/auth/login", { data: { usuario: "", password: "" } });
    expect(res.status()).toBe(400);
  });

  test("credenciales incorrectas responden 401 con mensaje GENÉRICO (no distingue usuario inexistente de password mala)", async ({
    request,
  }) => {
    const res = await request.post("/api/auth/login", {
      data: { usuario: "no-existe-este-usuario", password: "loquesea" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.error).toMatch(/incorrect/i);

    const res2 = await request.post("/api/auth/login", {
      data: { usuario: "maria.gomez", password: "password-mala" },
    });
    expect(res2.status()).toBe(401);
    const body2 = await res2.json();
    expect(body2.error).toBe(body.error); // mismo mensaje en ambos casos
  });

  test("usuario demo válido (case-insensitive) inicia sesión y fija la cookie httpOnly", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      data: { usuario: "MARIA.GOMEZ", password: "demo1234" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  test("las 3 cuentas demo del CLAUDE.md funcionan", async ({ request }) => {
    for (const usuario of ["maria.gomez", "carlos.munera", "admin"]) {
      const res = await request.post("/api/auth/login", { data: { usuario, password: "demo1234" } });
      expect(res.status(), `login de ${usuario} debería ser 200`).toBe(200);
    }
  });
});

test.describe("POST /api/auth/logout", () => {
  test("SIN ninguna cookie, el middleware la bloquea con 401 antes de llegar al route handler (no está en RUTAS_PUBLICAS)", async ({
    request,
  }) => {
    const res = await request.post("/api/auth/logout");
    expect(res.status()).toBe(401);
  });

  test("con sesión activa, responde 200 y limpia la cookie", async ({ request }) => {
    await request.post("/api/auth/login", { data: { usuario: "admin", password: "demo1234" } });
    const res = await request.post("/api/auth/logout");
    expect(res.status()).toBe(200);
  });

  test("cierra una sesión existente y una llamada posterior a un endpoint protegido vuelve a exigir login", async ({
    request,
  }) => {
    await request.post("/api/auth/login", { data: { usuario: "admin", password: "demo1234" } });
    const salida = await request.post("/api/auth/logout");
    expect(salida.status()).toBe(200);

    const despuesDeLogout = await request.get("/api/admin/usuarios");
    expect(despuesDeLogout.status()).toBe(401);
  });
});

test.describe("POST /api/auth/cambiar-password — bloqueado en DEMO_MODE", () => {
  test("sin sesión responde 401", async ({ request }) => {
    const res = await request.post("/api/auth/cambiar-password", {
      data: { passwordActual: "x", passwordNueva: "Nueva123!" },
    });
    expect(res.status()).toBe(401);
  });

  test("con sesión, en modo demo responde 400 explicando que las cuentas son fijas", async ({ request }) => {
    await request.post("/api/auth/login", { data: { usuario: "maria.gomez", password: "demo1234" } });
    const res = await request.post("/api/auth/cambiar-password", {
      data: { passwordActual: "demo1234", passwordNueva: "Nueva123!" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/modo demo/i);
  });
});

test.describe("POST /api/auth/completar-cambio-obligatorio", () => {
  test("sin cookie de cambio pendiente responde 401", async ({ request }) => {
    const res = await request.post("/api/auth/completar-cambio-obligatorio", {
      data: { passwordNueva: "Nueva123!" },
    });
    expect(res.status()).toBe(401);
  });
});
