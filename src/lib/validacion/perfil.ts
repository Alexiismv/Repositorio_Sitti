import { z } from "zod";

import { ACCIONES, PANTALLAS, PANTALLA_ACCION, WIDGETS } from "@/lib/auth/modulos";

const SLUGS_PANTALLA = new Set(PANTALLAS.map((p) => p.slug));
const SLUGS_ACCION = new Set(ACCIONES.map((a) => a.slug));
const SLUGS_WIDGET = new Set(WIDGETS.map((w) => w.slug));

/**
 * Esquema del formulario de perfil (spec 3.3). Valida que las pantallas,
 * acciones y widgets elegidos existan en el catálogo, y que cada acción
 * marcada tenga sentido dentro de la pantalla a la que se asignó
 * (`PANTALLA_ACCION`) — evita que un cliente manipulado guarde una
 * combinación que la UI nunca ofrecería.
 */
export const esquemaPerfil = z
  .object({
    nombre: z.string().trim().min(1, "El nombre del perfil es obligatorio.").max(120),
    descripcion: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v ? v : null)),
    activo: z.boolean().default(true),
    pantallas: z.array(z.string()).default([]),
    // pantalla_slug -> [accion_slug, ...]
    acciones: z.record(z.string(), z.array(z.string())).default({}),
    widgets: z.array(z.string()).default([]),
  })
  .superRefine((datos, ctx) => {
    for (const slug of datos.pantallas) {
      if (!SLUGS_PANTALLA.has(slug)) {
        ctx.addIssue({ code: "custom", message: `Pantalla desconocida: ${slug}`, path: ["pantallas"] });
      }
    }
    for (const [pantalla, accs] of Object.entries(datos.acciones)) {
      if (!SLUGS_PANTALLA.has(pantalla)) {
        ctx.addIssue({ code: "custom", message: `Pantalla desconocida: ${pantalla}`, path: ["acciones"] });
        continue;
      }
      const validas = new Set(PANTALLA_ACCION[pantalla] ?? []);
      for (const accion of accs) {
        if (!SLUGS_ACCION.has(accion) || !validas.has(accion)) {
          ctx.addIssue({
            code: "custom",
            message: `Acción "${accion}" no válida para la pantalla "${pantalla}".`,
            path: ["acciones", pantalla],
          });
        }
      }
    }
    for (const slug of datos.widgets) {
      if (!SLUGS_WIDGET.has(slug)) {
        ctx.addIssue({ code: "custom", message: `Widget desconocido: ${slug}`, path: ["widgets"] });
      }
    }
  });

export type DatosPerfil = z.infer<typeof esquemaPerfil>;
