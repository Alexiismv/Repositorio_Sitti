import { describe, expect, it } from "vitest";
import {
  AREAS,
  areaPorSlug,
  areasDeGerencia,
  categoriaDeEstado,
  gerenciaPorSlug,
  GERENCIAS,
  sedePorSlug,
  volumenGerencia,
} from "@/lib/catalogo";

describe("regresión: mapeo Área -> Gerencia (corregido 2 sep 2026, CLAUDE.md §2.1)", () => {
  it.each(["radicacion", "cad", "digitalizacion"])(
    "el área '%s' pertenece a Jurídica, no a Operación Contravencional",
    (slug) => {
      expect(areaPorSlug(slug)?.gerencia).toBe("juridica");
    },
  );
});

describe("regresión: sede 'Centro de Servicios' (corregido 27 ago 2026, CLAUDE.md §9)", () => {
  it("el nombre literal usa S mayúscula, exacto como llega de Jira (customfield_10066)", () => {
    const sede = sedePorSlug("centro-de-servicios");
    expect(sede?.nombre).toBe("Centro de Servicios");
  });
});

describe("volumenGerencia()", () => {
  it("nunca está hardcodeado: siempre es la suma de las áreas hijas", () => {
    for (const g of GERENCIAS) {
      const sumaEsperada = areasDeGerencia(g.slug).reduce((acc, a) => acc + a.volumen2026, 0);
      expect(volumenGerencia(g.slug)).toBe(sumaEsperada);
    }
  });

  it("una gerencia sin áreas (o solo con áreas en 0) da volumen 0, no undefined/NaN", () => {
    expect(volumenGerencia("gerencia-que-no-existe")).toBe(0);
  });
});

describe("jerarquía Área -> Gerencia", () => {
  it("toda área del catálogo apunta a una gerencia que existe", () => {
    const slugsGerencia = new Set(GERENCIAS.map((g) => g.slug));
    for (const area of AREAS) {
      expect(slugsGerencia.has(area.gerencia)).toBe(true);
    }
  });

  it("areasDeGerencia() solo trae áreas de esa gerencia (blindaje del filtro Gerencia->Área)", () => {
    const areasJuridica = areasDeGerencia("juridica");
    expect(areasJuridica.length).toBeGreaterThan(0);
    expect(areasJuridica.every((a) => a.gerencia === "juridica")).toBe(true);
    // Caso puntual del bug documentado: no debe colarse ninguna combinación
    // imposible como Gerencia=Operación Contravencional + Área=radicacion.
    const areasContravencional = areasDeGerencia("operacion-contravencional");
    expect(areasContravencional.some((a) => a.slug === "radicacion")).toBe(false);
  });
});

describe("gerenciaPorSlug() / areaPorSlug() / sedePorSlug()", () => {
  it("devuelven undefined (no lanzan) ante un slug inexistente", () => {
    expect(gerenciaPorSlug("no-existe")).toBeUndefined();
    expect(areaPorSlug("no-existe")).toBeUndefined();
    expect(sedePorSlug("no-existe")).toBeUndefined();
  });
});

describe("categoriaDeEstado()", () => {
  it("normaliza estados literales conocidos de ambos vocabularios (estandar y mesa)", () => {
    expect(categoriaDeEstado("RESUELTO")).toBe("resuelto");
    expect(categoriaDeEstado("ABIERTO")).toBe("pendiente");
    expect(categoriaDeEstado("EN PROGRESO")).toBe("en-progreso");
    expect(categoriaDeEstado("CANCELADO")).toBe("cancelado");
  });

  it("un estado literal desconocido cae por defecto en 'pendiente' (nunca lanza, nunca se pierde el ticket)", () => {
    expect(categoriaDeEstado("ALGO_QUE_JIRA_INVENTE_MAÑANA")).toBe("pendiente");
  });
});
