import { describe, expect, it } from "vitest";
import { describirFiltros, filtrosDesdeSearchParams } from "@/lib/reportes-filtros";

describe("filtrosDesdeSearchParams()", () => {
  it("sin ningún parámetro, devuelve estado 'todos' y el resto sin definir", () => {
    expect(filtrosDesdeSearchParams({})).toEqual({
      gerencias: undefined,
      areas: undefined,
      sedes: undefined,
      personas: undefined,
      tiposRequerimiento: undefined,
      estado: "todos",
      desde: undefined,
      hasta: undefined,
      soloIncumplidos: false,
      soloEstancados: false,
    });
  });

  it("área es MULTI-valor: ?area=x&area=y no debe perder ningún valor", () => {
    const f = filtrosDesdeSearchParams({ area: ["cartera", "financiera"] });
    expect(f.areas).toEqual(["cartera", "financiera"]);
  });

  it("un solo ?area=x (string, no array) también se traduce a lista de 1", () => {
    expect(filtrosDesdeSearchParams({ area: "cartera" }).areas).toEqual(["cartera"]);
  });

  it("gerencia/sede/persona/tipo son single-valor: si llega array, toma solo el primero", () => {
    const f = filtrosDesdeSearchParams({ gerencia: ["juridica", "financiera"] });
    expect(f.gerencias).toEqual(["juridica"]);
  });

  it("valores vacíos o solo espacios en área no cuentan como filtro activo", () => {
    expect(filtrosDesdeSearchParams({ area: ["", "  "] }).areas).toBeUndefined();
  });

  it("'desde' se normaliza a medianoche UTC y 'hasta' a fin de día — para no perder el último día", () => {
    const f = filtrosDesdeSearchParams({ desde: "2026-01-01", hasta: "2026-01-31" });
    expect(f.desde).toBe("2026-01-01T00:00:00.000Z");
    expect(f.hasta).toBe("2026-01-31T23:59:59.999Z");
  });

  it("rojo=1 y estancado=1 activan los booleanos; cualquier otro valor no", () => {
    expect(filtrosDesdeSearchParams({ rojo: "1" }).soloIncumplidos).toBe(true);
    expect(filtrosDesdeSearchParams({ rojo: "true" }).soloIncumplidos).toBe(false);
    expect(filtrosDesdeSearchParams({ estancado: "1" }).soloEstancados).toBe(true);
  });

  it("es EXACTAMENTE la misma traducción que usa la pantalla /reportes y el endpoint de exportar (mismo query string -> mismo Filtros)", () => {
    const query = { gerencia: "juridica", area: ["radicacion", "cad"], sede: "caribe", rojo: "1" };
    const a = filtrosDesdeSearchParams(query);
    const b = filtrosDesdeSearchParams({ ...query });
    expect(a).toEqual(b);
  });
});

describe("describirFiltros()", () => {
  it("sin filtros, da el mensaje explícito de 'todos los tickets visibles'", () => {
    expect(describirFiltros({})).toBe("Sin filtros — todos los tickets visibles para el usuario");
  });

  it("resuelve slugs a nombres legibles usando el catálogo (gerencia, área, sede)", () => {
    const texto = describirFiltros({ gerencia: "juridica", area: ["radicacion"], sede: "caribe" });
    expect(texto).toContain("Gerencia: Jurídica");
    expect(texto).toContain("Área: Radicación");
    expect(texto).toContain("Sede: Caribe");
  });

  it("un slug que no existe en el catálogo se muestra tal cual (no lanza, no lo oculta)", () => {
    expect(describirFiltros({ gerencia: "slug-inventado" })).toContain("Gerencia: slug-inventado");
  });

  it("incluye 'Solo tickets en rojo' y el umbral de estancado cuando esos flags están activos", () => {
    const texto = describirFiltros({ rojo: "1", estancado: "1" });
    expect(texto).toContain("Solo tickets en rojo");
    expect(texto).toContain("Solo estancados (5+ días sin movimiento)");
  });
});
