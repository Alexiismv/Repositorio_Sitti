import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter, Space_Grotesk } from "next/font/google";

import { ProveedorTema, SCRIPT_TEMA, TEMA_POR_DEFECTO } from "@/components/tema";

import "./globals.css";

// Tipografía confirmada en la sección 9: Space Grotesk (display) + Inter (cuerpo)
// + IBM Plex Mono (datos/etiquetas). Se sirven self-hosted vía next/font para que
// la app funcione aunque el servidor no tenga salida a fonts.googleapis.com.
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--fuente-display",
  display: "swap",
});

const cuerpo = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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
};

export const viewport: Viewport = {
  themeColor: "#181B4A",
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
      </body>
    </html>
  );
}
