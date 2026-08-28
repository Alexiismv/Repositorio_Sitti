/**
 * Derivación de la clave que firma y verifica las sesiones.
 *
 * Vive en su propio módulo, sin dependencias de Node, para que lo puedan
 * importar tanto el runtime Edge (`middleware.ts`) como el runtime Node
 * (`sesion.ts`). Antes cada uno tenía su propia copia y **no se comportaban
 * igual**: `sesion.ts` lanzaba un error fuera de modo demo, mientras que el
 * middleware caía siempre, sin condición alguna, a un secreto escrito en el
 * repositorio. Con ese secreto público cualquiera puede firmar una cookie con
 * `rol: "administrador"` y entrar sin credenciales.
 *
 * Reglas, en orden:
 *
 * 1. Si hay un `AUTH_SECRET` de 32+ caracteres, se usa. Siempre.
 * 2. Si no lo hay, se usa un secreto de desarrollo **solo** cuando NO estamos
 *    en producción, para que `npm run dev` funcione sin configurar nada.
 * 3. En producción, sin secreto válido, se LANZA.
 *
 * El punto 3 es lo que hace que el sistema falle cerrado. La condición depende
 * de `NODE_ENV`/`VERCEL_ENV`, que los pone la plataforma, y ya no de
 * `DEMO_MODE`, que es una variable que se escribe a mano y que el §7.3 de
 * CLAUDE.md documenta habiendo quedado vacía en producción exactamente una vez.
 */

const LARGO_MINIMO = 32;

/** Secreto de desarrollo. Inservible fuera de local: `esProduccion()` lo bloquea. */
const SECRETO_DEV = "sitti-dev-secret-solo-local-no-sirve-en-prod";

function esProduccion(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL_ENV);
}

/**
 * Devuelve la clave HMAC, o lanza si en producción no hay una válida.
 *
 * Quien la llama NO debe capturar el error para seguir adelante: que una
 * request muera con 500 es preferible a atender con una sesión falsificable.
 */
export function claveSecreta(): Uint8Array {
  const secreto = process.env.AUTH_SECRET;

  if (secreto && secreto.length >= LARGO_MINIMO) {
    return new TextEncoder().encode(secreto);
  }

  if (esProduccion()) {
    throw new Error(
      `AUTH_SECRET ausente o de menos de ${LARGO_MINIMO} caracteres en un entorno de producción. ` +
        "La app se niega a arrancar antes que firmar sesiones con un secreto conocido. " +
        "Genera uno con: openssl rand -base64 32",
    );
  }

  return new TextEncoder().encode(SECRETO_DEV);
}

/**
 * ¿Hay un secreto utilizable? Sin lanzar.
 *
 * La usa el middleware, que corre en Edge y donde una excepción se traduce en
 * una página de error críptica: prefiere redirigir a /login.
 */
export function haySecretoUtilizable(): boolean {
  const secreto = process.env.AUTH_SECRET;
  if (secreto && secreto.length >= LARGO_MINIMO) return true;
  return !esProduccion();
}
