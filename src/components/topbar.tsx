"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { iniciales, puedeUsarAccion, puedeVerPantalla, type Sesion } from "@/lib/auth/tipos";
import { BotonTema } from "@/components/tema";
import { BotonRefrescar } from "@/components/boton-refrescar";

const ENLACES_BASE = [
  { href: "/", label: "Panel General" },
  { href: "/gerencias", label: "Gerencias" },
];

const ENLACE_PERSONAS = { href: "/personas", label: "Personas" };

const ENLACE_REPORTES = { href: "/reportes", label: "Reportes" };

export function Topbar({
  sesion,
  ultimaSync,
}: {
  sesion: Sesion;
  ultimaSync: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [controlAccesoAbierto, setControlAccesoAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const controlAccesoRef = useRef<HTMLDivElement>(null);

  // Cerrar los menús al hacer clic afuera o con Escape.
  useEffect(() => {
    if (!abierto && !controlAccesoAbierto) return;
    function fuera(e: MouseEvent) {
      if (abierto && contenedor.current && !contenedor.current.contains(e.target as Node)) {
        setAbierto(false);
      }
      if (
        controlAccesoAbierto &&
        controlAccesoRef.current &&
        !controlAccesoRef.current.contains(e.target as Node)
      ) {
        setControlAccesoAbierto(false);
      }
    }
    function escape(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setAbierto(false);
      setControlAccesoAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto, controlAccesoAbierto]);

  const enlaces = [
    ...ENLACES_BASE,
    ENLACE_REPORTES,
    ...(puedeVerPantalla(sesion, "personas") ? [ENLACE_PERSONAS] : []),
  ];

  // "Control de acceso" agrupa Usuarios y Perfiles en un desplegable propio,
  // en vez de dos enlaces sueltos en la barra — spec Alexis (sep 2026).
  const enlacesControlAcceso = [
    ...(puedeVerPantalla(sesion, "admin-usuarios") ? [{ href: "/admin/usuarios", label: "Usuarios" }] : []),
    ...(puedeVerPantalla(sesion, "admin-perfiles") ? [{ href: "/admin/perfiles", label: "Perfiles" }] : []),
  ];

  async function salir() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const activo = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sh-topbar" ref={contenedor}>
      <Link href="/" aria-label="SITTI — inicio" className="sh-logo-placa" style={{ display: "flex", flexShrink: 0 }}>
        <Image src="/logo-sitti.png" alt="SITTI" width={140} height={28} style={{ height: 28, width: "auto" }} priority />
      </Link>

      <nav className="sh-nav" aria-label="Navegación principal">
        <div className="sh-nav-scroll">
          {enlaces.map((e) => (
            <Link key={e.href} href={e.href} className={`sh-link ${activo(e.href) ? "activo" : ""}`}>
              {e.label}
            </Link>
          ))}
        </div>

        {enlacesControlAcceso.length > 0 && (
          <div
            className={`sh-nav-dropdown ${controlAccesoAbierto ? "abierto" : ""}`}
            ref={controlAccesoRef}
            onMouseEnter={() => setControlAccesoAbierto(true)}
            onMouseLeave={() => setControlAccesoAbierto(false)}
            onBlur={(e) => {
              // Foco por teclado (Tab): cierra solo si el foco salió del desplegable entero.
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setControlAccesoAbierto(false);
            }}
          >
            <button
              type="button"
              className={`sh-link sh-nav-trigger ${enlacesControlAcceso.some((e) => activo(e.href)) ? "activo" : ""}`}
              aria-haspopup="true"
              aria-expanded={controlAccesoAbierto}
              onFocus={() => setControlAccesoAbierto(true)}
            >
              Control de acceso
              <span className="sh-nav-caret" aria-hidden="true">
                ▾
              </span>
            </button>
            {controlAccesoAbierto && (
              <div className="sh-nav-dropdown-menu" role="menu">
                {enlacesControlAcceso.map((e) => (
                  <Link
                    key={e.href}
                    href={e.href}
                    className={activo(e.href) ? "activo" : ""}
                    onClick={() => setControlAccesoAbierto(false)}
                  >
                    {e.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="sh-sync" title="Última sincronización con Jira (el ETL corre 2 veces al día)">
        <span className="pulso" />
        Sync {ultimaSync}
      </div>

      <BotonRefrescar puedeSincronizar={puedeUsarAccion(sesion, "panel-general", "sincronizar")} />

      <BotonTema />

      <button className="sh-user" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span className="sh-avatar">{iniciales(sesion.nombre)}</span>
        <span className="sh-user-meta">
          <span className="nombre" style={{ display: "block" }}>
            {sesion.nombre}
          </span>
          <span className="rol" style={{ display: "block" }}>
            {sesion.perfiles.length > 0 ? sesion.perfiles.join(" · ") : "Sin perfil asignado"}
          </span>
        </span>
      </button>

      {abierto && (
        <div className="sh-menu" role="menu">
          <div className="sh-menu-head">
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{sesion.nombre}</div>
            <div className="correo">{sesion.email}</div>
          </div>
          {puedeVerPantalla(sesion, "admin-usuarios") && (
            <Link href="/admin/usuarios" onClick={() => setAbierto(false)}>
              Gestión de usuarios
            </Link>
          )}
          {puedeVerPantalla(sesion, "admin-perfiles") && (
            <Link href="/admin/perfiles" onClick={() => setAbierto(false)}>
              Gestión de perfiles
            </Link>
          )}
          <Link href="/cambiar-password" onClick={() => setAbierto(false)}>
            Cambiar mi contraseña
          </Link>
          <button className="peligro" onClick={salir}>
            Cerrar sesión
          </button>
        </div>
      )}
    </header>
  );
}
