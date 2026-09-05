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
 * Nunca en producción, pase lo que pase con la variable — salvo la llave
 * explícita de abajo.
 *
 * `NODE_ENV` y `VERCEL_ENV` las pone la plataforma, no una persona. Con esta
 * guarda, el escenario del §7.3 —`DEMO_MODE` quedó como cadena vacía en
 * Vercel— deja de poder activar las cuentas demo en la URL pública.
 */
const EN_PRODUCCION = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL_ENV);

/**
 * Segunda llave para saltar la guarda de arriba a propósito (decisión de
 * Alexis, 5 sep 2026, CLAUDE.md §7.5): mientras se le muestra el mockup a las
 * gerencias, Production necesita correr en modo demo con datos dummy. Se
 * separa de `DEMO_MODE` para que activar el modo demo en una URL pública
 * necesite DOS variables explícitas a la vez, no una — un `DEMO_MODE=true`
 * puesto por error (mismo patrón del bug de §7.3) ya no basta por sí solo
 * para exponer las cuentas demo en producción.
 */
const PERMITE_DEMO_PUBLICO = process.env.PERMITIR_DEMO_PUBLICO === "true";

export const DEMO_MODE = (!EN_PRODUCCION || PERMITE_DEMO_PUBLICO) && process.env.DEMO_MODE !== "false";
