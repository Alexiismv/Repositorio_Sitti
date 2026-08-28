/**
 * Modo de operación de la app.
 *
 * Vive en su propio módulo, sin dependencias, para que lo pueda importar tanto
 * el proveedor de datos (que arrastra el cliente de Postgres) como el generador
 * demo, sin que se importen entre ellos.
 *
 * ⚠️ La comparación es contra la cadena `"false"` EXACTA: cualquier otro valor
 * —incluida la cadena vacía— deja la app en modo demo. Ya costó un bug en
 * producción (ver CLAUDE.md § 7.3), así que la expresión vive en un solo lugar
 * y no se vuelve a copiar.
 */
export const DEMO_MODE = process.env.DEMO_MODE !== "false";
