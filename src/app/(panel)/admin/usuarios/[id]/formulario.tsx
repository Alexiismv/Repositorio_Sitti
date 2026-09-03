"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Combobox } from "@/components/combobox";
import { MultiSelectCheckbox } from "@/components/multi-select-checkbox";
import { Switch } from "@/components/switch";
import { useToast } from "@/components/toast-provider";
import { SEXOS, TIPOS_IDENTIFICACION, TIPOS_USUARIO, type TipoUsuario } from "@/lib/auth/catalogos-usuario";
import type { Perfil } from "@/lib/auth/tipos";
import type { UsuarioDetalle } from "@/lib/auth/usuarios-servicio";
import type { Sede } from "@/lib/catalogo";

const ETIQUETA = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  color: "var(--ink-soft)",
  marginBottom: 5,
};

export function FormularioUsuario({
  usuario,
  perfiles,
  sedes,
}: {
  usuario: UsuarioDetalle | null;
  perfiles: Perfil[];
  sedes: Sede[];
}) {
  const router = useRouter();
  const { notificar } = useToast();

  const [email, setEmail] = useState(usuario?.email ?? "");
  const [perfilesSel, setPerfilesSel] = useState<string[]>(usuario?.perfiles.map((p) => p.id) ?? []);
  const [controlIp, setControlIp] = useState(usuario?.controlIp ?? false);
  const [sedeSlug, setSedeSlug] = useState(usuario?.sedeSlug ?? "");
  const [activo, setActivo] = useState(usuario?.activo ?? true);
  const [tipoUsuario, setTipoUsuario] = useState<TipoUsuario>((usuario?.tipoUsuario as TipoUsuario) ?? "interno_sitti");

  const [tipoDocumento, setTipoDocumento] = useState(usuario?.tipoDocumento ?? "");
  const [numeroDocumento, setNumeroDocumento] = useState(usuario?.numeroDocumento ?? "");
  const [nombres, setNombres] = useState(usuario?.nombres ?? "");
  const [apellidos, setApellidos] = useState(usuario?.apellidos ?? "");
  const [sexo, setSexo] = useState(usuario?.sexo ?? "");
  const [celular, setCelular] = useState(usuario?.celular ?? "");

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !nombres.trim()) {
      setError("Usuario (correo) y Nombres son obligatorios.");
      return;
    }

    setEnviando(true);
    try {
      const cuerpo = {
        email: email.trim(),
        perfiles: perfilesSel,
        controlIp,
        sedeSlug: sedeSlug || undefined,
        activo,
        tipoUsuario,
        tipoDocumento: tipoDocumento || undefined,
        numeroDocumento: numeroDocumento.trim() || undefined,
        nombres: nombres.trim(),
        apellidos: apellidos.trim() || undefined,
        sexo: sexo || undefined,
        celular: celular.trim() || undefined,
      };

      const res = await fetch(usuario ? `/api/admin/usuarios/${usuario.id}` : "/api/admin/usuarios", {
        method: usuario ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(datos.error ?? "No se pudo guardar el usuario.");
        return;
      }
      notificar(
        usuario
          ? `Usuario "${cuerpo.nombres}" actualizado.`
          : `Usuario "${cuerpo.nombres}" creado con contraseña por defecto "admin".`,
        "ok",
      );
      router.push("/admin/usuarios");
      router.refresh();
    } catch {
      setError("No se pudo guardar el usuario. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      <div className="panel" style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={ETIQUETA}>Usuario (correo de acceso)</label>
          <input
            type="email"
            className="text-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label style={ETIQUETA}>Cargo</label>
          <MultiSelectCheckbox
            opciones={perfiles.map((p) => ({ slug: p.id, nombre: p.nombre }))}
            seleccionados={perfilesSel}
            onChange={setPerfilesSel}
            placeholderTodos="Sin perfiles asignados"
          />
        </div>

        <div>
          <label style={ETIQUETA}>Control de IP</label>
          <div style={{ display: "flex", gap: 18 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
              <input type="radio" name="control-ip" checked={controlIp} onChange={() => setControlIp(true)} /> Sí
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
              <input type="radio" name="control-ip" checked={!controlIp} onChange={() => setControlIp(false)} /> No
            </label>
          </div>
        </div>

        <div>
          <label style={ETIQUETA}>Sede</label>
          <Combobox
            opciones={sedes.map((s) => ({ valor: s.slug, nombre: s.nombre }))}
            valor={sedeSlug}
            onChange={setSedeSlug}
            etiquetaVacio="Sin sede asignada"
          />
        </div>

        <Switch checked={activo} onChange={setActivo} etiqueta={activo ? "Activo" : "Inactivo"} />

        <div>
          <label style={ETIQUETA}>Tipo usuario</label>
          <select
            className="text-input"
            value={tipoUsuario}
            onChange={(e) => setTipoUsuario(e.target.value as TipoUsuario)}
          >
            {TIPOS_USUARIO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <h4 style={{ marginBottom: 12 }}>Información personal</h4>

      <div className="panel" style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={ETIQUETA}>Tipo de identificación</label>
          <select className="text-input" value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
            <option value="">Seleccionar…</option>
            {TIPOS_IDENTIFICACION.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={ETIQUETA}>Número de documento</label>
          <input
            type="text"
            className="text-input"
            value={numeroDocumento}
            onChange={(e) => setNumeroDocumento(e.target.value)}
          />
        </div>

        <div>
          <label style={ETIQUETA}>Nombres</label>
          <input type="text" className="text-input" value={nombres} onChange={(e) => setNombres(e.target.value)} required />
        </div>

        <div>
          <label style={ETIQUETA}>Apellidos</label>
          <input type="text" className="text-input" value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
        </div>

        <div>
          <label style={ETIQUETA}>Sexo</label>
          <select className="text-input" value={sexo} onChange={(e) => setSexo(e.target.value)}>
            <option value="">Seleccionar…</option>
            {SEXOS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={ETIQUETA}>Celular (opcional)</label>
          <input type="text" className="text-input" value={celular} onChange={(e) => setCelular(e.target.value)} />
        </div>
      </div>

      {!usuario && (
        <p className="nota-demo" style={{ marginTop: 0 }}>
          El usuario se crea con la contraseña por defecto <span className="mono">admin</span>; deberá cambiarla
          en su primer inicio de sesión.
        </p>
      )}

      {error && <p style={{ color: "var(--red)", fontSize: 13, marginTop: 8 }}>{error}</p>}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
        <button type="button" className="btn-secundario" onClick={() => router.push("/admin/usuarios")} disabled={enviando}>
          Cancelar
        </button>
        <button type="submit" className="btn-primario" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
