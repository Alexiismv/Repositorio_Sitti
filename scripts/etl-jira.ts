/**
 * ETL Jira (JSM) → PostgreSQL, desde línea de comandos.
 *
 *   npm run etl -- --dry-run    trae 10 tickets y los IMPRIME. No escribe nada.
 *   npm run etl                 recarga COMPLETA (staging → swap atómico)
 *   npm run etl -- --incremental   solo lo movido en los últimos días
 *
 * Este archivo es solo la cáscara de línea de comandos. La lógica de verdad
 * vive en `src/lib/etl/`, compartida con el botón "Refrescar" de la app —
 * así la regla del switch de Área de SMM existe en un solo lugar y no puede
 * aplicarse en una ruta y olvidarse en la otra.
 *
 * Cuándo usar cada modo:
 *   - **Completo**: la primera carga, y cada tanto después. Es el único que
 *     detecta tickets BORRADOS en Jira, porque reconstruye la tabla entera.
 *   - **Incremental**: lo que usa el botón de la app. Rápido, pero no ve
 *     borrados.
 */

import { hayCredencialesJira, jqlCompleto, normalizar, traerIssues } from "../src/lib/etl/jira";
import { sincronizar } from "../src/lib/etl/sincronizar";
import { cargarEnv } from "./db";

const DRY_RUN = process.argv.includes("--dry-run");
const INCREMENTAL = process.argv.includes("--incremental");

async function main() {
  cargarEnv();

  if (!hayCredencialesJira()) {
    throw new Error(
      "Faltan credenciales de Jira. Define JIRA_BASE_URL, JIRA_EMAIL y JIRA_API_TOKEN en .env.\n" +
        "Cómo sacar el token: CLAUDE.md § 5.1.",
    );
  }

  if (DRY_RUN) {
    console.log("🔍 Dry run — 10 tickets, sin escribir en la base.\n");
    const issues = await traerIssues(jqlCompleto(), { limite: 10 });

    if (!issues.length) {
      console.log("No llegó ningún ticket. Revisa el JQL y los permisos de la cuenta.");
      return;
    }

    const f = issues[0].fields ?? {};
    console.log("─── ESTO ES LO QUE FALTABA CONFIRMAR ───");
    console.log("customfield_10044 (TTFR) llega así:");
    console.log(JSON.stringify(f.customfield_10044, null, 2));
    console.log("\ncustomfield_10043 (TTR) llega así:");
    console.log(JSON.stringify(f.customfield_10043, null, 2));
    console.log("\nreporter (Informador) llega así:");
    console.log(JSON.stringify(f.reporter, null, 2));
    console.log(
      "\n→ Si `parsearSla()` (en src/lib/etl/jira.ts) no interpreta bien esa forma,\n" +
        "  ajústala y anota el hallazgo en docs/REQUISITOS.md § 7 y en CLAUDE.md § 9.\n" +
        "→ `texto()` toma `displayName` de `reporter` — si necesitas el correo del\n" +
        "  cliente en vez del nombre, revisa si viene `emailAddress` en el objeto\n" +
        "  de arriba y ajusta `informador` en `normalizar()`.\n",
    );

    console.log("─── Normalizado (primeros 3) ───");
    for (const i of issues.slice(0, 3)) console.log(normalizar(i));
    return;
  }

  const modo = INCREMENTAL ? "incremental" : "completo";
  console.log(`→ Sincronización ${modo}…`);

  const r = await sincronizar({
    modo,
    alProgresar: (etapa, n, total) => {
      process.stdout.write(`\r   ${etapa}: ${n}${total ? ` / ${total}` : ""}      `);
    },
  });

  process.stdout.write("\n");
  console.log(
    `\n✅ Listo en ${(r.duracionMs / 1000).toFixed(1)}s — ${r.totalTickets} tickets procesados, ` +
      `${r.filasEnTabla} en la tabla · ${r.totalBacklog} ítems de backlog.`,
  );
  if (process.env.DEMO_MODE !== "false") {
    console.log("   Recuerda poner DEMO_MODE=false para que la app lea de la base.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("\n❌ ETL falló:\n", e instanceof Error ? e.message : e);
    process.exit(1);
  });
