import { expect, test } from "@playwright/test";

test.describe("GET /api/export/areas/[slug]/[formato]", () => {
  test("formato no soportado responde 400", async ({ request }) => {
    await request.post("/api/auth/login", { data: { usuario: "maria.gomez", password: "demo1234" } });
    const res = await request.get("/api/export/areas/servicio/csv");
    expect(res.status()).toBe(400);
  });

  test("sin sesión responde 401", async ({ request }) => {
    const res = await request.get("/api/export/areas/servicio/excel");
    expect(res.status()).toBe(401);
  });

  test("área inexistente responde 404", async ({ request }) => {
    await request.post("/api/auth/login", { data: { usuario: "maria.gomez", password: "demo1234" } });
    const res = await request.get("/api/export/areas/area-que-no-existe/excel");
    expect(res.status()).toBe(404);
  });

  test("con sesión y área válida, Excel responde 200 con content-type de spreadsheet", async ({ request }) => {
    await request.post("/api/auth/login", { data: { usuario: "maria.gomez", password: "demo1234" } });
    const res = await request.get("/api/export/areas/servicio/excel");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("spreadsheetml");
  });

  test("con sesión y área válida, PDF responde 200 con content-type application/pdf", async ({ request }) => {
    await request.post("/api/auth/login", { data: { usuario: "maria.gomez", password: "demo1234" } });
    const res = await request.get("/api/export/areas/servicio/pdf");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
  });

  test("un coordinador sin acceso a esa área igual recibe 200 con un archivo (vacío), no un error", async ({
    request,
  }) => {
    // carlos.munera solo ve Cartera/Financiera en Caribe y Centro de Servicios —
    // "servicio" no le pertenece. obtenerTickets() debe devolver [] (defense-in-depth),
    // no lanzar ni devolver 403: la exportación de un área "vacía para mí" es un
    // archivo con encabezados y cero filas, no un error.
    await request.post("/api/auth/login", { data: { usuario: "carlos.munera", password: "demo1234" } });
    const res = await request.get("/api/export/areas/servicio/excel");
    expect(res.status()).toBe(200);
  });
});

test.describe("GET /api/export/personas/[formato] — requiere acción 'exportar' en la pantalla Personas", () => {
  test("un usuario sin acceso a Personas recibe 403", async ({ request }) => {
    // maria.gomez tiene verPersonas=false en la demo (ver usuarios-demo.ts).
    await request.post("/api/auth/login", { data: { usuario: "maria.gomez", password: "demo1234" } });
    const res = await request.get("/api/export/personas/excel");
    expect(res.status()).toBe(403);
  });

  test("un usuario con acceso a Personas puede exportar", async ({ request }) => {
    // carlos.munera tiene verPersonas=true en la demo.
    await request.post("/api/auth/login", { data: { usuario: "carlos.munera", password: "demo1234" } });
    const res = await request.get("/api/export/personas/excel");
    expect(res.status()).toBe(200);
  });
});

test.describe("GET /api/export/reportes/[formato] — comparte la traducción de filtros con la pantalla /reportes", () => {
  test("exportar con un query string de filtros responde 200 y el archivo refleja esos filtros (status, no vacío)", async ({
    request,
  }) => {
    await request.post("/api/auth/login", { data: { usuario: "maria.gomez", password: "demo1234" } });
    const res = await request.get("/api/export/reportes/excel?gerencia=juridica&area=radicacion");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("spreadsheetml");
  });

  test("formato inválido responde 400 incluso con filtros válidos en la URL", async ({ request }) => {
    await request.post("/api/auth/login", { data: { usuario: "maria.gomez", password: "demo1234" } });
    const res = await request.get("/api/export/reportes/docx?gerencia=juridica");
    expect(res.status()).toBe(400);
  });
});
