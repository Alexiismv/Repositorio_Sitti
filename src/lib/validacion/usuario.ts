import { z } from "zod";

/**
 * Esquema del formulario de usuario (spec 2.1/2.2). `celular` es
 * explícitamente opcional y sin regex de validación — pedido puntual de la
 * spec ("Celular (opcional)"), a diferencia del resto de campos de texto.
 */
export const esquemaUsuario = z.object({
  email: z.string().trim().min(1, "El usuario de acceso es obligatorio.").max(160).email("Correo inválido."),
  perfiles: z.array(z.string()).default([]),
  controlIp: z.boolean().default(false),
  sedesSlugs: z.array(z.string()).default([]),
  activo: z.boolean().default(true),
  tipoUsuario: z.enum(["interno_sitti", "externo_smm", "externo_esu"]).default("interno_sitti"),

  tipoDocumento: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  numeroDocumento: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v ? v : null)),
  nombres: z.string().trim().min(1, "Los nombres son obligatorios.").max(160),
  apellidos: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v ? v : null)),
  sexo: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  celular: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v ? v : null)),
});

export type DatosUsuario = z.infer<typeof esquemaUsuario>;
