import { describe, expect, it, vi } from "vitest";
import { AREAS, TOTAL_2026 } from "@/lib/catalogo";

describe("ticketsDemo() — determinismo (PRNG semillado, sin Math.random ni Date.now)", () => {
  it("dos corridas del generador en procesos distintos dan EXACTAMENTE el mismo dataset", async () => {
    // Cada import fresco del módulo repite la generación desde cero (cache a
    // nivel de módulo reseteada por vi.resetModules()), simulando dos procesos.
    vi.resetModules();
    const { ticketsDemo: generar1 } = await import("@/lib/demo/generador");
    const datasetA = generar1();

    vi.resetModules();
    const { ticketsDemo: generar2 } = await import("@/lib/demo/generador");
    const datasetB = generar2();

    expect(datasetA).toEqual(datasetB);
  });

  it("el total generado es exactamente la suma de volumen2026 de las 24 áreas del catálogo", async () => {
    const { ticketsDemo } = await import("@/lib/demo/generador");
    expect(ticketsDemo()).toHaveLength(TOTAL_2026);
  });

  it("llamar ticketsDemo() varias veces en el mismo proceso reutiliza la cache (misma referencia)", async () => {
    const { ticketsDemo } = await import("@/lib/demo/generador");
    expect(ticketsDemo()).toBe(ticketsDemo());
  });

  it("cada área aporta exactamente su volumen2026 confirmado de tickets", async () => {
    const { ticketsDemo } = await import("@/lib/demo/generador");
    const tickets = ticketsDemo();
    const area = AREAS.find((a) => a.slug === "cartera")!;
    const deEsaArea = tickets.filter((t) => t.areaSlug === "cartera");
    expect(deEsaArea).toHaveLength(area.volumen2026);
  });

  it("todo ticket de 'Mesa de ayuda SMM' (REQ) tiene sede fija 'Caribe' (regla dura del switch SMM)", async () => {
    const { ticketsDemo } = await import("@/lib/demo/generador");
    const ticketsSmm = ticketsDemo().filter((t) => t.proyectoClave === "REQ");
    expect(ticketsSmm.length).toBeGreaterThan(0);
    expect(ticketsSmm.every((t) => t.sede === "Caribe")).toBe(true);
  });

  it("ttrHoras es null en tickets que siguen abiertos y numérico en los cerrados", async () => {
    const { ticketsDemo } = await import("@/lib/demo/generador");
    const tickets = ticketsDemo();
    const abiertos = tickets.filter((t) => t.categoriaEstado !== "resuelto" && t.categoriaEstado !== "cancelado");
    const cerrados = tickets.filter((t) => t.categoriaEstado === "resuelto" || t.categoriaEstado === "cancelado");
    expect(abiertos.some((t) => t.ttrHoras === null)).toBe(true);
    expect(cerrados.length).toBeGreaterThan(0);
    expect(cerrados.every((t) => t.ttrHoras !== null)).toBe(true);
  });
});
