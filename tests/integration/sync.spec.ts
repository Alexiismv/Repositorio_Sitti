import { expect, test } from "@playwright/test";

test.describe("POST /api/sync", () => {
  test("sin sesión responde 401", async ({ request }) => {
    const res = await request.post("/api/sync");
    expect(res.status()).toBe(401);
  });

  test("un Coordinador sin la acción 'sincronizar' recibe 403", async ({ request }) => {
    // ACCESO_POR_ROL.coordinador solo da ["ver"] en panel-general, no "sincronizar".
    await request.post("/api/auth/login", { data: { usuario: "carlos.munera", password: "demo1234" } });
    const res = await request.post("/api/sync");
    expect(res.status()).toBe(403);
  });

  test("un Gerente (tiene la acción 'sincronizar') en DEMO_MODE recibe 200 con demo:true, no un error", async ({
    request,
  }) => {
    await request.post("/api/auth/login", { data: { usuario: "maria.gomez", password: "demo1234" } });
    const res = await request.post("/api/sync");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toEqual(expect.objectContaining({ ok: false, demo: true }));
  });
});
