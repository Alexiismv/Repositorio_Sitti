/**
 * Catálogos fijos del formulario de usuario (spec 2.1/2.2) sin precedente en
 * el repo — confirmados con Alexis (sep 2026).
 */

export interface OpcionCatalogo {
  valor: string;
  nombre: string;
}

export const TIPOS_IDENTIFICACION: OpcionCatalogo[] = [
  { valor: "CC", nombre: "Cédula de Ciudadanía" },
  { valor: "CE", nombre: "Cédula de Extranjería" },
  { valor: "TI", nombre: "Tarjeta de Identidad" },
  { valor: "PA", nombre: "Pasaporte" },
  { valor: "NIT", nombre: "NIT" },
];

export const SEXOS: OpcionCatalogo[] = [
  { valor: "M", nombre: "Masculino" },
  { valor: "F", nombre: "Femenino" },
  { valor: "Otro", nombre: "Otro" },
];

export type TipoUsuario = "interno_sitti" | "externo_smm" | "externo_esu";

export const TIPOS_USUARIO: { valor: TipoUsuario; nombre: string }[] = [
  { valor: "interno_sitti", nombre: "Interno SITTI" },
  { valor: "externo_smm", nombre: "Externo - SMM" },
  { valor: "externo_esu", nombre: "Externo - ESU" },
];

export const TIPO_USUARIO_LABEL: Record<TipoUsuario, string> = Object.fromEntries(
  TIPOS_USUARIO.map((t) => [t.valor, t.nombre]),
) as Record<TipoUsuario, string>;
