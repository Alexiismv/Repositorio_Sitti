import { describe, expect, it } from "vitest";
import { iniciales, puedeUsarAccion, puedeVer, puedeVerPantalla, puedeVerWidget, veTodo } from "@/lib/auth/tipos";

describe("veTodo()", () => {
  it("requiere la fila comodín exacta ('*','*') — no basta con sede='*' sola", () => {
    expect(veTodo({ permisos: [{ sede: "*", area: "*" }] })).toBe(true);
    expect(veTodo({ permisos: [{ sede: "*", area: "cartera" }] })).toBe(false);
    expect(veTodo({ permisos: [{ sede: "caribe", area: "*" }] })).toBe(false);
    expect(veTodo({ permisos: [] })).toBe(false);
  });
});

describe("puedeVer() — permiso anidado (sede, área), no dos listas independientes", () => {
  const permisosCoordinador = [
    { sede: "caribe", area: "cartera" },
    { sede: "centro-de-servicios", area: "financiera" },
  ];

  it("permite exactamente la combinación asignada", () => {
    expect(puedeVer({ permisos: permisosCoordinador }, "caribe", "cartera")).toBe(true);
  });

  it("NO permite cruzar sede de una fila con área de otra fila (el caso que motiva la tupla)", () => {
    // Coordinador ve Cartera en Caribe y Financiera en Centro de Servicios,
    // pero NUNCA Financiera en Caribe ni Cartera en Centro de Servicios.
    expect(puedeVer({ permisos: permisosCoordinador }, "caribe", "financiera")).toBe(false);
    expect(puedeVer({ permisos: permisosCoordinador }, "centro-de-servicios", "cartera")).toBe(false);
  });

  it("comodín de área ('*') dentro de una sede específica ve todas las áreas de ESA sede solamente", () => {
    const permisos = [{ sede: "caribe", area: "*" }];
    expect(puedeVer({ permisos }, "caribe", "cualquier-area")).toBe(true);
    expect(puedeVer({ permisos }, "poblado", "cualquier-area")).toBe(false);
  });

  it("comodín total ('*','*') ve cualquier combinación", () => {
    const permisos = [{ sede: "*", area: "*" }];
    expect(puedeVer({ permisos }, "cualquier-sede", "cualquier-area")).toBe(true);
  });

  it("sin permisos, no ve nada", () => {
    expect(puedeVer({ permisos: [] }, "caribe", "cartera")).toBe(false);
  });
});

describe("puedeVerPantalla() / puedeUsarAccion() / puedeVerWidget() — permisos de UI, independientes de los de datos", () => {
  const sesion = {
    pantallas: ["panel-general", "personas"],
    acciones: { "panel-general": ["sincronizar"], personas: [] },
    widgets: ["mapa-sedes"],
  };

  it("puedeVerPantalla solo es true para pantallas explícitamente listadas", () => {
    expect(puedeVerPantalla(sesion, "personas")).toBe(true);
    expect(puedeVerPantalla(sesion, "admin-usuarios")).toBe(false);
  });

  it("puedeUsarAccion exige la acción DENTRO de esa pantalla específica", () => {
    expect(puedeUsarAccion(sesion, "panel-general", "sincronizar")).toBe(true);
    expect(puedeUsarAccion(sesion, "personas", "sincronizar")).toBe(false);
    expect(puedeUsarAccion(sesion, "pantalla-inexistente", "sincronizar")).toBe(false);
  });

  it("puedeVerWidget consulta la lista de widgets habilitados", () => {
    expect(puedeVerWidget(sesion, "mapa-sedes")).toBe(true);
    expect(puedeVerWidget(sesion, "grafico-que-no-tiene")).toBe(false);
  });
});

describe("iniciales()", () => {
  it("toma la primera letra de hasta 2 palabras, en mayúscula", () => {
    expect(iniciales("Carlos Múnera")).toBe("CM");
    expect(iniciales("Ana María Restrepo Gómez")).toBe("AM");
  });

  it("un solo nombre da una sola inicial, sin lanzar", () => {
    expect(iniciales("Admin")).toBe("A");
  });

  it("espacios extra no producen iniciales vacías", () => {
    expect(iniciales("  Carlos   Múnera  ")).toBe("CM");
  });
});
