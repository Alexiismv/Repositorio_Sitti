"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ROL_LABEL, iniciales, puedeVerPersonas, type Sesion } from "@/lib/auth/tipos";
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
  const contenedor = useRef<HTMLDivElement>(null);

  // Cerrar el menú al hacer clic afuera o con Escape.
  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setAbierto(false);
    }
    function escape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  const enlaces = [
    ...ENLACES_BASE,
    ...(puedeVerPersonas(sesion) ? [ENLACE_PERSONAS] : []),
    ENLACE_REPORTES,
    ...(sesion.rol === "administrador" ? [{ href: "/admin/usuarios", label: "Usuarios" }] : []),
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
        {enlaces.map((e) => (
          <Link key={e.href} href={e.href} className={`sh-link ${activo(e.href) ? "activo" : ""}`}>
            {e.label}
          </Link>
        ))}
      </nav>

      <div className="sh-sync" title="Última sincronización con Jira (el ETL corre 2 veces al día)">
        <span className="pulso" />
        Sync {ultimaSync}
      </div>

      <BotonRefrescar
        puedeSincronizar={sesion.rol === "gerente" || sesion.rol === "administrador"}
      />

      <BotonTema />

      <button className="sh-user" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        <span className="sh-avatar">{iniciales(sesion.nombre)}</span>
        <span className="sh-user-meta">
          <span className="nombre" style={{ display: "block" }}>
            {sesion.nombre}
          </span>
          <span className="rol" style={{ display: "block" }}>
            {ROL_LABEL[sesion.rol]}
          </span>
        </span>
      </button>

      {abierto && (
        <div className="sh-menu" role="menu">
          <div className="sh-menu-head">
            <div style={{ fontSize: 13.5, fontWeight: 600 }}>{sesion.nombre}</div>
            <div className="correo">{sesion.email}</div>
          </div>
          {sesion.rol === "administrador" && (
            <Link href="/admin/usuarios" onClick={() => setAbierto(false)}>
              Gestión de usuarios
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
