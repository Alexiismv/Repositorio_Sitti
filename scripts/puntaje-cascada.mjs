#!/usr/bin/env node
/**
 * Orquestador de puntaje de la cascada de pruebas.
 *
 * Lee los reportes JSON que cada etapa ya dejó en `reportes-prueba/` (Vitest
 * para unitarias, Playwright para integración/E2E/smoke), calcula el % de
 * éxito de cada una, las combina en un puntaje ponderado, y lo traduce al
 * mismo semáforo que ya usa el resto del panel para el cumplimiento de SLA
 * (verde >=90, amarillo >=80, rojo <80 — ver semaforoDeCumplimiento() en
 * src/lib/metricas.ts).
 *
 * Una etapa que no corrió (el archivo no existe — ej. no hay Preview
 * Deployment todavía para el E2E) se excluye del cálculo y los pesos de las
 * etapas restantes se renormalizan, en vez de contar como 0% o reventar.
 *
 * Uso: node scripts/puntaje-cascada.mjs
 * Variable opcional REPORTES_DIR para cambiar dónde busca los JSON (default "reportes-prueba").
 */

import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const DIR = process.env.REPORTES_DIR ?? "reportes-prueba";

/** peso relativo de cada etapa dentro del puntaje final */
const ETAPAS = [
  { id: "unitarias", nombre: "Etapa 1 · Unitarias (Vitest)", archivo: "unitarias.json", peso: 25, tipo: "vitest" },
  {
    id: "integracion",
    nombre: "Etapa 2 · Integración API (Playwright)",
    archivo: "integracion.json",
    peso: 25,
    tipo: "playwright",
  },
  { id: "e2e", nombre: "Etapa 3 · E2E multi-rol (Playwright)", archivo: "e2e.json", peso: 35, tipo: "playwright" },
  { id: "smoke", nombre: "Etapa 4 · Smoke de producción (Playwright)", archivo: "smoke.json", peso: 15, tipo: "playwright" },
];

function leerJson(ruta) {
  return JSON.parse(readFileSync(ruta, "utf8"));
}

function resultadoVitest(reporte) {
  const total = reporte.numTotalTests ?? 0;
  const pasados = reporte.numPassedTests ?? 0;
  return { total, pasados };
}

function resultadoPlaywright(reporte) {
  const s = reporte.stats ?? {};
  const pasados = (s.expected ?? 0) + (s.flaky ?? 0);
  const total = pasados + (s.unexpected ?? 0);
  return { total, pasados };
}

function semaforoDeCumplimiento(pct) {
  return pct >= 90 ? "verde" : pct >= 80 ? "amarillo" : "rojo";
}

const EMOJI = { verde: "🟢", amarillo: "🟡", rojo: "🔴" };

function main() {
  const filas = [];

  for (const etapa of ETAPAS) {
    const ruta = join(DIR, etapa.archivo);
    if (!existsSync(ruta)) {
      filas.push({ ...etapa, estado: "no-corrida" });
      continue;
    }

    let reporte;
    try {
      reporte = leerJson(ruta);
    } catch (err) {
      filas.push({ ...etapa, estado: "error-lectura", error: String(err) });
      continue;
    }

    const { total, pasados } = etapa.tipo === "vitest" ? resultadoVitest(reporte) : resultadoPlaywright(reporte);
    if (total === 0) {
      filas.push({ ...etapa, estado: "sin-pruebas" });
      continue;
    }

    const pct = Math.round((pasados / total) * 1000) / 10;
    filas.push({ ...etapa, estado: "ok", total, pasados, pct, semaforo: semaforoDeCumplimiento(pct) });
  }

  const evaluadas = filas.filter((f) => f.estado === "ok");
  const pesoTotal = evaluadas.reduce((acc, f) => acc + f.peso, 0);

  // Gate: si NINGUNA etapa corrió (ej. build falló antes de llegar aquí),
  // no hay nada que promediar — puntaje 0, rojo explícito.
  const puntajeFinal = pesoTotal > 0 ? Math.round((evaluadas.reduce((acc, f) => acc + f.pct * f.peso, 0) / pesoTotal) * 10) / 10 : 0;
  const semaforoFinal = semaforoDeCumplimiento(puntajeFinal);

  const lineas = [];
  lineas.push(`# ${EMOJI[semaforoFinal]} Cascada de pruebas — ${puntajeFinal}% (${semaforoFinal})`);
  lineas.push("");
  lineas.push("| Etapa | Resultado | % éxito | Peso | Semáforo |");
  lineas.push("|---|---|---|---|---|");
  for (const f of filas) {
    if (f.estado === "ok") {
      lineas.push(`| ${f.nombre} | ${f.pasados}/${f.total} | ${f.pct}% | ${f.peso}% | ${EMOJI[f.semaforo]} |`);
    } else if (f.estado === "no-corrida") {
      lineas.push(`| ${f.nombre} | — no corrió — | — | ${f.peso}% (excluido) | ⚪ |`);
    } else {
      lineas.push(`| ${f.nombre} | ⚠️ ${f.estado} | — | ${f.peso}% (excluido) | ⚪ |`);
    }
  }
  lineas.push("");
  lineas.push(
    semaforoFinal === "verde"
      ? "Versión estable — se puede promover."
      : semaforoFinal === "amarillo"
        ? "Hay fallas no críticas — revisar antes de promover."
        : "No promover: fallas por debajo del umbral aceptable.",
  );

  const texto = lineas.join("\n");
  console.log(texto);

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, texto + "\n");
  }

  // Exit code distinto de 0 en rojo, para que el step de CI se marque en fallo
  // sin depender de que alguien lea el resumen.
  process.exit(semaforoFinal === "rojo" ? 1 : 0);
}

main();
