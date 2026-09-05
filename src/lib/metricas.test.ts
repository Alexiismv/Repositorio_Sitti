import { describe, expect, it } from "vitest";
import {
  cumplimientoTtrPorPrioridad,
  diasAbierto,
  estancados,
  masAntiguosSinResolver,
  masComentados,
  modaDe,
  porArea,
  porGerencia,
  porMes,
  porPersona,
  porProyecto,
  porSede,
  porSemana,
  porTipoRequerimiento,
  resumen,
  semaforo,
  semaforoDeCumplimiento,
  tableroEstados,
} from "@/lib/metricas";
import type { Ticket } from "@/lib/demo/generador";
import { AREAS, GERENCIAS } from "@/lib/catalogo";

/** Fabrica un ticket mínimo válido, sobreescribible por caso de prueba. */
function ticket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    clave: "TMA-1",
    tituloTicket: "Ticket de prueba",
    proyecto: "Mesa de ayuda SITTI",
    proyectoClave: "TMA",
    fechaCreacion: "2026-03-10T12:00:00.000Z",
    fechaCierre: null,
    fechaActualizacion: "2026-03-10T12:00:00.000Z",
    personaAsignada: "Ana Restrepo",
    informador: "Juan Pérez",
    estadoTicket: "ABIERTO",
    categoriaEstado: "pendiente",
    prioridad: "Media",
    tipoIncidencia: "Incidente",
    tipoRequerimiento: "Solicitud de información",
    sede: "Caribe",
    area: "Servicio",
    areaSlug: "servicio",
    gerenciaSlug: "experiencia-de-servicio",
    ttfrHoras: 2,
    ttrHoras: null,
    ttfrIncumplido: false,
    ttrIncumplido: false,
    comentarios: 0,
    diasSinActualizar: 0,
    ...overrides,
  };
}

describe("resumen()", () => {
  it("cuenta pendientes como total menos resueltos y cancelados", () => {
    const tickets = [
      ticket({ categoriaEstado: "resuelto" }),
      ticket({ categoriaEstado: "cancelado" }),
      ticket({ categoriaEstado: "pendiente" }),
      ticket({ categoriaEstado: "en-progreso" }),
    ];
    const r = resumen(tickets);
    expect(r.total).toBe(4);
    expect(r.resueltos).toBe(1);
    expect(r.cancelados).toBe(1);
    expect(r.pendientes).toBe(2);
  });

  it("con dataset vacío no divide por cero y devuelve todo en 0", () => {
    const r = resumen([]);
    expect(r).toEqual({
      total: 0,
      pendientes: 0,
      resueltos: 0,
      cancelados: 0,
      promedioMensual: 0,
      cumplimientoTtfr: 0,
      cumplimientoTtr: 0,
      ttfrPromedioHoras: 0,
      ttrPromedioHoras: 0,
      estancados: 0,
    });
  });

  it("promedioMensual se divide entre meses CON actividad, no entre 12 fijo", () => {
    // Dos tickets en el mismo mes (enero) -> 1 mes con actividad -> promedio = total.
    const tickets = [
      ticket({ fechaCreacion: "2026-01-05T00:00:00.000Z" }),
      ticket({ fechaCreacion: "2026-01-20T00:00:00.000Z" }),
    ];
    expect(resumen(tickets).promedioMensual).toBe(2);
  });

  it("cumplimientoTtfr solo considera tickets con ttfrHoras no nulo", () => {
    const tickets = [
      ticket({ ttfrHoras: 1, ttfrIncumplido: false }),
      ticket({ ttfrHoras: 10, ttfrIncumplido: true }),
      ticket({ ttfrHoras: null }), // no debe contar ni en el numerador ni el denominador
    ];
    // 1 de 2 cumple -> 50%
    expect(resumen(tickets).cumplimientoTtfr).toBe(50);
  });

  it("estancados exige abierto Y diasSinActualizar >= umbral (5 por defecto)", () => {
    const tickets = [
      ticket({ categoriaEstado: "pendiente", diasSinActualizar: 5 }), // sí
      ticket({ categoriaEstado: "pendiente", diasSinActualizar: 4 }), // no, falta 1 día
      ticket({ categoriaEstado: "resuelto", diasSinActualizar: 30 }), // no, ya está resuelto
      ticket({ categoriaEstado: "cancelado", diasSinActualizar: 30 }), // no, cancelado no es "abierto"
    ];
    expect(resumen(tickets).estancados).toBe(1);
  });

  it("respeta un umbral de estancado distinto al default cuando se pasa explícito", () => {
    const tickets = [ticket({ categoriaEstado: "pendiente", diasSinActualizar: 3 })];
    expect(resumen(tickets, 3).estancados).toBe(1);
    expect(resumen(tickets, 5).estancados).toBe(0);
  });
});

describe("semaforoDeCumplimiento()", () => {
  it("verde en >=90, amarillo en >=80, rojo por debajo de 80 — cortes exactos", () => {
    expect(semaforoDeCumplimiento(100)).toBe("verde");
    expect(semaforoDeCumplimiento(90)).toBe("verde");
    expect(semaforoDeCumplimiento(89)).toBe("amarillo");
    expect(semaforoDeCumplimiento(80)).toBe("amarillo");
    expect(semaforoDeCumplimiento(79)).toBe("rojo");
    expect(semaforoDeCumplimiento(0)).toBe("rojo");
  });
});

describe("cumplimientoTtrPorPrioridad()", () => {
  it("evalúa cada prioridad contra SU PROPIA meta (Alta 4h, Media 8h, Baja 24h)", () => {
    const tickets = [
      ticket({ prioridad: "Alta", ttrHoras: 3, ttrIncumplido: false }),
      ticket({ prioridad: "Alta", ttrHoras: 10, ttrIncumplido: true }),
      ticket({ prioridad: "Baja", ttrHoras: 20, ttrIncumplido: false }),
    ];
    const filas = cumplimientoTtrPorPrioridad(tickets);
    const alta = filas.find((f) => f.prioridad === "Alta")!;
    const media = filas.find((f) => f.prioridad === "Media")!;
    const baja = filas.find((f) => f.prioridad === "Baja")!;

    expect(alta.metaHoras).toBe(4);
    expect(alta.cumplimiento).toBe(50); // 1 de 2
    expect(media.cumplimiento).toBe(0); // grupo vacío -> 0, no NaN
    expect(baja.metaHoras).toBe(24);
    expect(baja.cumplimiento).toBe(100);
  });

  it("siempre devuelve las 3 prioridades, incluso sin tickets", () => {
    const filas = cumplimientoTtrPorPrioridad([]);
    expect(filas.map((f) => f.prioridad).sort()).toEqual(["Alta", "Baja", "Media"].sort());
  });
});

describe("porMes()", () => {
  it("cuenta creados por mes de creación y resueltos por mes de CIERRE, no de creación", () => {
    const tickets = [
      ticket({ fechaCreacion: "2026-01-15T00:00:00.000Z", fechaCierre: "2026-02-01T00:00:00.000Z" }),
    ];
    const serie = porMes(tickets);
    const enero = serie.find((p) => p.mes === "Ene")!;
    const febrero = serie.find((p) => p.mes === "Feb")!;
    expect(enero.creados).toBe(1);
    expect(enero.resueltos).toBe(0);
    expect(febrero.creados).toBe(0);
    expect(febrero.resueltos).toBe(1);
  });
});

describe("porSemana()", () => {
  it("devuelve el número de semanas pedido y la última se llama 'Esta sem.'", () => {
    const serie = porSemana([], 4);
    expect(serie).toHaveLength(4);
    expect(serie.at(-1)!.semana).toBe("Esta sem.");
  });

  it("la ventana de cada semana es (inicio, fin] — un ticket exactamente en el borde de inicio no cuenta", () => {
    // fechaCorte() en modo demo es fija: 2026-08-20T18:00:00.000Z (ver generador.ts).
    const finSemanaActual = new Date("2026-08-20T18:00:00.000Z").getTime();
    const inicioUltimaSemana = finSemanaActual - 7 * 86_400_000;
    const tickets = [
      ticket({ fechaCreacion: new Date(inicioUltimaSemana).toISOString() }), // justo en el borde -> NO cuenta
      ticket({ fechaCreacion: new Date(inicioUltimaSemana + 1).toISOString() }), // 1ms después -> SÍ cuenta
    ];
    const ultima = porSemana(tickets, 1)[0];
    expect(ultima.creados).toBe(1);
  });
});

describe("desagregaciones (porGerencia/porArea/porSede/porPersona/porTipoRequerimiento/porProyecto)", () => {
  it("porGerencia excluye grupos con total 0 y ordena descendente", () => {
    const tickets = [
      ticket({ gerenciaSlug: "juridica" }),
      ticket({ gerenciaSlug: "juridica" }),
      ticket({ gerenciaSlug: "financiera" }),
    ];
    const filas = porGerencia(tickets);
    expect(filas[0].slug).toBe("juridica");
    expect(filas[0].total).toBe(2);
    expect(filas.every((f) => f.total > 0)).toBe(true);
    // No debe incluir gerencias sin tickets (hay 8 en el catálogo, aquí solo 2 con datos).
    expect(filas).toHaveLength(2);
  });

  it("porArea asocia el color de la GERENCIA padre a cada área (jerarquía real)", () => {
    const areaJuridica = AREAS.find((a) => a.slug === "radicacion")!;
    const gerenciaJuridica = GERENCIAS.find((g) => g.slug === "juridica")!;
    const tickets = [ticket({ areaSlug: "radicacion", gerenciaSlug: "juridica" })];
    const fila = porArea(tickets).find((f) => f.slug === areaJuridica.slug)!;
    expect(fila.color).toBe(gerenciaJuridica.color);
  });

  it("porSede agrupa por NOMBRE de sede (no por slug) porque así viene en el ticket", () => {
    const tickets = [ticket({ sede: "Caribe" }), ticket({ sede: "Caribe" }), ticket({ sede: "Poblado" })];
    const filas = porSede(tickets);
    expect(filas.find((f) => f.slug === "caribe")?.total).toBe(2);
    expect(filas.find((f) => f.slug === "poblado")?.total).toBe(1);
  });

  it("porPersona agrega ttrPromedio y estancados además de los campos base", () => {
    const tickets = [
      ticket({ personaAsignada: "Ana Restrepo", categoriaEstado: "pendiente", diasSinActualizar: 10 }),
    ];
    const fila = porPersona(tickets).find((f) => f.slug === "Ana Restrepo")!;
    expect(fila.estancados).toBe(1);
  });

  it("porTipoRequerimiento y porProyecto agrupan por el campo literal del ticket", () => {
    const tickets = [
      ticket({ tipoRequerimiento: "Acuerdo de pago", proyecto: "Cobro Coactivo" }),
      ticket({ tipoRequerimiento: "Acuerdo de pago", proyecto: "Cobro Coactivo" }),
    ];
    expect(porTipoRequerimiento(tickets)[0].total).toBe(2);
    expect(porProyecto(tickets)[0].total).toBe(2);
  });
});

describe("listas operativas", () => {
  it("masAntiguosSinResolver excluye resueltos/cancelados y ordena por fecha de creación ascendente", () => {
    const tickets = [
      ticket({ clave: "A", categoriaEstado: "pendiente", fechaCreacion: "2026-03-01T00:00:00.000Z" }),
      ticket({ clave: "B", categoriaEstado: "pendiente", fechaCreacion: "2026-01-01T00:00:00.000Z" }),
      ticket({ clave: "C", categoriaEstado: "resuelto", fechaCreacion: "2025-01-01T00:00:00.000Z" }),
    ];
    const resultado = masAntiguosSinResolver(tickets, 5);
    expect(resultado.map((t) => t.clave)).toEqual(["B", "A"]);
  });

  it("masComentados ordena descendente por número de comentarios", () => {
    const tickets = [ticket({ clave: "A", comentarios: 1 }), ticket({ clave: "B", comentarios: 9 })];
    expect(masComentados(tickets, 2).map((t) => t.clave)).toEqual(["B", "A"]);
  });

  it("estancados respeta el límite opcional sin perder el orden por antigüedad", () => {
    const tickets = [
      ticket({ clave: "A", categoriaEstado: "pendiente", diasSinActualizar: 10 }),
      ticket({ clave: "B", categoriaEstado: "pendiente", diasSinActualizar: 20 }),
    ];
    const resultado = estancados(tickets, 5, 1);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].clave).toBe("B");
  });

  it("diasAbierto se calcula contra fechaCorte(), no contra Date.now()", () => {
    // fechaCorte() en demo es fija: 2026-08-20T18:00:00.000Z
    const t = ticket({ fechaCreacion: "2026-08-10T18:00:00.000Z" });
    expect(diasAbierto(t)).toBe(10);
  });

  it("tableroEstados siempre trae las 5 categorías, incluso vacías, en el orden del catálogo", () => {
    const tablero = tableroEstados([ticket({ categoriaEstado: "pendiente" })]);
    expect(tablero.map((c) => c.categoria)).toEqual([
      "pendiente",
      "en-progreso",
      "esperando-terceros",
      "resuelto",
      "cancelado",
    ]);
    expect(tablero.find((c) => c.categoria === "pendiente")!.tickets).toHaveLength(1);
    expect(tablero.find((c) => c.categoria === "resuelto")!.tickets).toHaveLength(0);
  });

  it("modaDe devuelve '—' con dataset vacío y el valor más frecuente si hay datos", () => {
    expect(modaDe([], (t) => t.sede)).toBe("—");
    const tickets = [ticket({ sede: "Caribe" }), ticket({ sede: "Caribe" }), ticket({ sede: "Poblado" })];
    expect(modaDe(tickets, (t) => t.sede)).toBe("Caribe");
  });

  it("semaforo() por ticket: rojo si incumplió, amarillo si va cerca del límite (>75% de la meta), verde si no", () => {
    expect(semaforo(ticket({ ttrIncumplido: true }))).toBe("rojo");
    expect(semaforo(ticket({ ttfrIncumplido: true }))).toBe("rojo");
    // Media: meta TTR 8h. 75% = 6h. 7h > 6h -> amarillo.
    expect(semaforo(ticket({ prioridad: "Media", ttrHoras: 7, ttfrHoras: 0 }))).toBe("amarillo");
    // TTFR cerca del límite: meta 4h, 75% = 3h. 3.5h > 3h -> amarillo.
    expect(semaforo(ticket({ ttfrHoras: 3.5, ttrHoras: null }))).toBe("amarillo");
    expect(semaforo(ticket({ ttfrHoras: 1, ttrHoras: 1, prioridad: "Media" }))).toBe("verde");
  });
});
