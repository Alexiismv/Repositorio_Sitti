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
/**
 * Nunca en producción, pase lo que pase con la variable.
 *
 * `NODE_ENV` y `VERCEL_ENV` las pone la plataforma, no una persona. Con esta
 * guarda, el escenario del §7.3 —`DEMO_MODE` quedó como cadena vacía en
 * Vercel— deja de poder activar las cuentas demo en la URL pública.
 */
const EN_PRODUCCION = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL_ENV);

export const DEMO_MODE = !EN_PRODUCCION && process.env.DEMO_MODE !== "false";
