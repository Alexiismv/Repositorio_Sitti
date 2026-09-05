import { expect, test } from "@playwright/test";

/**
 * Gate de `/api/admin/**` (`requiereAdmin()`): 401 sin sesión, 403 sin la
 * pantalla habilitada, 503 en DEMO_MODE (ver src/lib/auth/requiere-admin.ts).
 * El orden importa: se prueba cada capa por separado para no enmascarar una
 * regresión con otra (ej. que un 403 "por accidente" tape que el 503 dejó de
 * disparar).
 */

test.describe("GET /api/admin/usuarios", () => {
  test("sin sesión responde 401", async ({ request }) => {
    const res = await request.get("/api/admin/usuarios");
    expect(res.status()).toBe(401);
  });

  test("con sesión de Gerente (sin pantalla admin-usuarios) responde 403", async ({ request }) => {
    await request.post("/api/auth/login", { data: { usuario: "maria.gomez", password: "demo1234" } });
    const res = await request.get("/api/admin/usuarios");
    expect(res.status()).toBe(403);
  });

  test("con sesión de Coordinador responde 403 (tampoco tiene la pantalla)", async ({ request }) => {
    await request.post("/api/auth/login", { data: { usuario: "carlos.munera", password: "demo1234" } });
    const res = await request.get("/api/admin/usuarios");
    expect(res.status()).toBe(403);
  });

  test("con sesión de Administrador, en DEMO_MODE responde 503 (pasó el gate de pantalla, lo frena el modo demo)", async ({
    request,
  }) => {
    await request.post("/api/auth/login", { data: { usuario: "admin", password: "demo1234" } });
    const res = await request.get("/api/admin/usuarios");
    expect(res.status()).toBe(503);
  });
});

test.describe("GET /api/admin/perfiles — misma cascada de permisos", () => {
  test("sin sesión 401, con Gerente 403, con Administrador 503", async ({ request }) => {
    const sinSesion = await request.get("/api/admin/perfiles");
    expect(sinSesion.status()).toBe(401);

    await request.post("/api/auth/login", { data: { usuario: "maria.gomez", password: "demo1234" } });
    const conGerente = await request.get("/api/admin/perfiles");
    expect(conGerente.status()).toBe(403);

    await request.post("/api/auth/logout");
    await request.post("/api/auth/login", { data: { usuario: "admin", password: "demo1234" } });
    const conAdmin = await request.get("/api/admin/perfiles");
    expect(conAdmin.status()).toBe(503);
  });
});

test.describe("POST /api/admin/usuarios/[id]/restablecer-password", () => {
  test("Administrador en modo demo también recibe 503, no puede restablecer nada", async ({ request }) => {
    await request.post("/api/auth/login", { data: { usuario: "admin", password: "demo1234" } });
    const res = await request.post("/api/admin/usuarios/cualquier-id/restablecer-password");
    expect(res.status()).toBe(503);
  });
});
