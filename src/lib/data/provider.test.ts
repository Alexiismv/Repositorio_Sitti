import { describe, expect, it } from "vitest";
import { obtenerTickets, resolverArea, type Filtros } from "@/lib/data/provider";
import type { Sesion } from "@/lib/auth/tipos";

/** Sesión con acceso total — comodín ('*','*'), como Gerente/Administrador. */
const sesionVeTodo: Sesion = {
  sub: "1",
  email: "gerente@sitti.test",
  nombre: "Gerente Demo",
  permisos: [{ sede: "*", area: "*" }],
  perfiles: ["Gerente"],
  pantallas: [],
  acciones: {},
  widgets: [],
};

/** Sesión recortada, réplica del caso real "carlos.munera": solo Cartera/Financiera en Caribe + Centro de Servicios. */
const sesionCoordinador: Sesion = {
  ...sesionVeTodo,
  sub: "2",
  permisos: [
    { sede: "caribe", area: "cartera" },
    { sede: "caribe", area: "financiera" },
    { sede: "centro-de-servicios", area: "cartera" },
    { sede: "centro-de-servicios", area: "financiera" },
  ],
};

describe("resolverArea() — el switch de Área es una regla de negocio dura (CLAUDE.md §2.1)", () => {
  it("nombre NULL (campo Área nunca se llenó en Jira) cae en el bucket 'sin-nombre'", () => {
    const r = resolverArea(null);
    expect(r.areaSlug).toBe("sin-nombre");
  });

  it("nombre que coincide exactamente con un área del catálogo resuelve a esa área", () => {
    const r = resolverArea("Cartera");
    expect(r.areaSlug).toBe("cartera");
    expect(r.gerenciaSlug).toBe("financiera");
  });

  it("alias conocido de Jira (nombre distinto, misma área real) se traduce ANTES de buscar en el catálogo", () => {
    const r = resolverArea("Gestión Juridica Documental");
    expect(r.areaSlug).toBe("gestion-juridica-de-cobro");
  });

  it("texto que no coincide con ninguna área conocida ni alias cae en 'Otras' (no se pierde el ticket)", () => {
    const r = resolverArea("Un valor de Dependencia_SMM que no está mapeado todavía");
    expect(r.areaSlug).toBe("otras");
    // El nombre visible conserva el texto original de Jira, solo el slug cae en "Otras".
    expect(r.area).toBe("Un valor de Dependencia_SMM que no está mapeado todavía");
  });
});

describe("obtenerTickets() — recorte de permisos SIEMPRE en servidor (defense-in-depth)", () => {
  it("una sesión con comodín ('*','*') ve tickets de más de una sede/área", async () => {
    const tickets = await obtenerTickets(sesionVeTodo);
    const sedes = new Set(tickets.map((t) => t.sede));
    expect(tickets.length).toBeGreaterThan(0);
    expect(sedes.size).toBeGreaterThan(1);
  });

  it("una sesión recortada NUNCA devuelve tickets fuera de su tupla (sede, área), aunque no se pase ningún filtro de UI", async () => {
    const tickets = await obtenerTickets(sesionCoordinador);
    expect(tickets.length).toBeGreaterThan(0);
    for (const t of tickets) {
      const combinacionPermitida =
        (t.sede === "Caribe" || t.sede === "Centro de Servicios") &&
        (t.areaSlug === "cartera" || t.areaSlug === "financiera");
      expect(combinacionPermitida).toBe(true);
    }
  });

  it("una sesión sin ningún permiso no ve absolutamente nada", async () => {
    const sesionSinPermisos: Sesion = { ...sesionVeTodo, permisos: [] };
    const tickets = await obtenerTickets(sesionSinPermisos);
    expect(tickets).toEqual([]);
  });

  it("el recorte de permisos se aplica AUNQUE la UI ya haya filtrado por otra área (no basta con confiar en el filtro de pantalla)", async () => {
    // El coordinador pide explícitamente un área que NO le pertenece (vía filtro),
    // el resultado debe seguir vacío, no confiar ciegamente en lo pedido.
    const filtros: Filtros = { areas: ["radicacion"] };
    const tickets = await obtenerTickets(sesionCoordinador, filtros);
    expect(tickets).toEqual([]);
  });
});

describe("obtenerTickets() con Filtros — cumpleFiltros() vía la función pública", () => {
  it("filtra por rango de fechas (desde/hasta) sobre fechaCreacion", async () => {
    const filtros: Filtros = { desde: "2026-01-01T00:00:00.000Z", hasta: "2026-01-31T23:59:59.999Z" };
    const tickets = await obtenerTickets(sesionVeTodo, filtros);
    expect(tickets.length).toBeGreaterThan(0);
    for (const t of tickets) {
      expect(t.fechaCreacion >= filtros.desde!).toBe(true);
      expect(t.fechaCreacion <= filtros.hasta!).toBe(true);
    }
  });

  it("estado='pendientes' excluye resueltos y cancelados", async () => {
    const tickets = await obtenerTickets(sesionVeTodo, { estado: "pendientes" });
    expect(tickets.every((t) => t.categoriaEstado !== "resuelto" && t.categoriaEstado !== "cancelado")).toBe(
      true,
    );
  });

  it("estado='resueltos' solo trae categoría 'resuelto' (no 'cancelado')", async () => {
    const tickets = await obtenerTickets(sesionVeTodo, { estado: "resueltos" });
    expect(tickets.every((t) => t.categoriaEstado === "resuelto")).toBe(true);
  });

  it("soloIncumplidos ('en rojo') exige ttrIncumplido O ttfrIncumplido", async () => {
    const tickets = await obtenerTickets(sesionVeTodo, { soloIncumplidos: true });
    expect(tickets.length).toBeGreaterThan(0);
    expect(tickets.every((t) => t.ttrIncumplido || t.ttfrIncumplido)).toBe(true);
  });

  it("soloEstancados exige abierto y diasSinActualizar >= umbral por defecto (5)", async () => {
    const tickets = await obtenerTickets(sesionVeTodo, { soloEstancados: true });
    expect(tickets.length).toBeGreaterThan(0);
    for (const t of tickets) {
      expect(t.categoriaEstado === "resuelto" || t.categoriaEstado === "cancelado").toBe(false);
      expect(t.diasSinActualizar).toBeGreaterThanOrEqual(5);
    }
  });

  it("un filtro que no matchea a ningún ticket devuelve lista vacía, no error", async () => {
    const tickets = await obtenerTickets(sesionVeTodo, { personas: ["Nombre Que No Existe En El Dataset"] });
    expect(tickets).toEqual([]);
  });
});
