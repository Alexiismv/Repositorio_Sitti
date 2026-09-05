import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LARGO, validarPasswordNueva } from "@/lib/auth/password";

describe("validarPasswordNueva()", () => {
  it("devuelve null cuando la contraseña cumple los 3 requisitos", () => {
    expect(validarPasswordNueva("Segura2026!")).toBeNull();
  });

  it(`exige mínimo ${PASSWORD_MIN_LARGO} caracteres`, () => {
    expect(validarPasswordNueva("Ab1!")).toBe(`Mínimo ${PASSWORD_MIN_LARGO} caracteres`);
  });

  it("exige al menos una mayúscula (acepta tildes/ñ)", () => {
    expect(validarPasswordNueva("segura2026!")).toBe("Al menos 1 letra mayúscula");
    expect(validarPasswordNueva("Área2026!")).toBeNull();
  });

  it("exige al menos un carácter especial", () => {
    expect(validarPasswordNueva("Segura2026")).toBe("Al menos 1 carácter especial (ej. !@#$%&*)");
  });

  it("devuelve el PRIMER requisito que falla, en el orden largo -> mayúscula -> especial", () => {
    // Falla en los 3 a la vez: debe reportar "largo" primero.
    expect(validarPasswordNueva("ab")).toBe(`Mínimo ${PASSWORD_MIN_LARGO} caracteres`);
  });

  it("una contraseña vacía falla por longitud, no lanza excepción", () => {
    expect(validarPasswordNueva("")).toBe(`Mínimo ${PASSWORD_MIN_LARGO} caracteres`);
  });
});
