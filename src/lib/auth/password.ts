/**
 * Reglas de contraseña para el autoservicio "Cambiar mi contraseña".
 *
 * Se valida en cliente (feedback inmediato) y siempre de nuevo en el servidor
 * (`/api/auth/cambiar-password`) — la validación de cliente es UX, no
 * seguridad: la fuente de verdad es esta misma función corriendo en el API route.
 */

const REGEX_MAYUSCULA = /[A-ZÁÉÍÓÚÑ]/;
const REGEX_ESPECIAL = /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ]/;

export const PASSWORD_MIN_LARGO = 8;

export interface ReglaPassword {
  id: string;
  descripcion: string;
  cumple: (password: string) => boolean;
}

export const REGLAS_PASSWORD: ReglaPassword[] = [
  {
    id: "largo",
    descripcion: `Mínimo ${PASSWORD_MIN_LARGO} caracteres`,
    cumple: (p) => p.length >= PASSWORD_MIN_LARGO,
  },
  {
    id: "mayuscula",
    descripcion: "Al menos 1 letra mayúscula",
    cumple: (p) => REGEX_MAYUSCULA.test(p),
  },
  {
    id: "especial",
    descripcion: "Al menos 1 carácter especial (ej. !@#$%&*)",
    cumple: (p) => REGEX_ESPECIAL.test(p),
  },
];

/** Devuelve el primer requisito que falla, o `null` si la contraseña cumple todos. */
export function validarPasswordNueva(password: string): string | null {
  const regla = REGLAS_PASSWORD.find((r) => !r.cumple(password));
  return regla ? regla.descripcion : null;
}
