import type { Metadata, Viewport } from "next";
import { Fredoka, IBM_Plex_Mono, Lato } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { ProveedorTema, SCRIPT_TEMA, TEMA_POR_DEFECTO } from "@/components/tema";

import "./globals.css";

// Tipografía del Manual de Marca oficial (29 ago 2026): Magdelin (títulos) +
// Lato (cuerpo/web) + Arial Nova (office, no aplica acá). Magdelin no tiene
// archivo de licencia disponible para web, así que se aproxima con Fredoka
// (geométrica, redondeada, mismo peso amistoso que se ve en los títulos del
// manual) — ver CLAUDE.md §2.3 regla 11. Se sirven self-hosted vía next/font
// para que la app funcione aunque el servidor no tenga salida a
// fonts.googleapis.com. Lato no tiene pesos 500/600 en Google Fonts (solo
// 100/300/400/700/900) — se usa 400/700, el navegador matchea el más cercano
// para cualquier font-weight intermedio pedido en CSS.
const display = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--fuente-display",
  display: "swap",
});

const cuerpo = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--fuente-cuerpo",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--fuente-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SITTI — Panel de Gestión",
  description:
    "Indicadores de gestión de la operación de movilidad de Medellín. Seguimiento por sede, área y persona.",

  /*
   * Sin indexar. El §7.3 de CLAUDE.md lo pide explícitamente mientras el
   * proyecto sea una sorpresa para las gerencias: la URL de Vercel es pública
   * para quien la adivine, y un buscador la volvería encontrable. Se retira
   * cuando el proyecto sea oficial.
   */
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#191B2B",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" data-tema={TEMA_POR_DEFECTO} suppressHydrationWarning>
      <head>
        {/*
          Se aplica el tema antes del primer paint para que no haya flashazo
          blanco al entrar en modo oscuro. `suppressHydrationWarning` en <html>
          es necesario porque este script modifica el atributo antes de que
          React hidrate, y React lo vería como una diferencia servidor/cliente.
        */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className={`${display.variable} ${cuerpo.variable} ${mono.variable}`}>
        <ProveedorTema>{children}</ProveedorTema>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
