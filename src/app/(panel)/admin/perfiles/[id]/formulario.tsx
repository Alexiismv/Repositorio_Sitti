"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Switch } from "@/components/switch";
import { useToast } from "@/components/toast-provider";
import { ACCIONES, PANTALLAS, PANTALLA_ACCION, WIDGETS } from "@/lib/auth/modulos";
import type { PerfilDetalle } from "@/lib/auth/tipos";

const NOMBRE_ACCION = new Map(ACCIONES.map((a) => [a.slug, a.nombre]));

export function FormularioPerfil({ perfil }: { perfil: PerfilDetalle | null }) {
  const router = useRouter();
  const { notificar } = useToast();

  const soloLectura = Boolean(perfil?.esSistema);

  const [nombre, setNombre] = useState(perfil?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(perfil?.descripcion ?? "");
  const [activo, setActivo] = useState(perfil?.activo ?? true);
  const [pantallasSel, setPantallasSel] = useState<string[]>(perfil?.pantallas ?? []);
  const [accionesSel, setAccionesSel] = useState<Record<string, string[]>>(perfil?.acciones ?? {});
  const [widgetsSel, setWidgetsSel] = useState<string[]>(perfil?.widgets ?? []);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function alternarPantalla(slug: string) {
    setPantallasSel((actual) => {
      const marcada = actual.includes(slug);
      if (marcada) {
        // Al destildar la pantalla, sus acciones y widgets dejan de tener
        // sentido — se limpian para que el estado nunca guarde una
        // combinación que la UI ya no muestra.
        setAccionesSel((acc) => {
          const copia = { ...acc };
          delete copia[slug];
          return copia;
        });
        setWidgetsSel((w) => w.filter((s) => !WIDGETS.find((wi) => wi.slug === s && wi.pantalla === slug)));
        return actual.filter((s) => s !== slug);
      }
      return [...actual, slug];
    });
  }

  function alternarAccion(pantalla: string, accion: string) {
    setAccionesSel((actual) => {
      const actuales = actual[pantalla] ?? [];
      const nuevas = actuales.includes(accion) ? actuales.filter((a) => a !== accion) : [...actuales, accion];
      return { ...actual, [pantalla]: nuevas };
    });
  }

  function alternarWidget(slug: string) {
    setWidgetsSel((actual) => (actual.includes(slug) ? actual.filter((s) => s !== slug) : [...actual, slug]));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("El nombre del perfil es obligatorio.");
      return;
    }

    setEnviando(true);
    try {
      const cuerpo = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        activo,
        pantallas: pantallasSel,
        acciones: accionesSel,
        widgets: widgetsSel,
      };
      const res = await fetch(perfil ? `/api/admin/perfiles/${perfil.id}` : "/api/admin/perfiles", {
        method: perfil ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(datos.error ?? "No se pudo guardar el perfil.");
        return;
      }
      notificar(`Perfil "${cuerpo.nombre}" guardado.`, "ok");
      router.push("/admin/perfiles");
      router.refresh();
    } catch {
      setError("No se pudo guardar el perfil. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      {soloLectura && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <p className="nota-demo" style={{ marginTop: 0 }}>
            El perfil <strong>Administrador</strong> es del sistema: tiene acceso total siempre y no se puede
            editar ni eliminar.
          </p>
        </div>
      )}

      <div className="panel" style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label className="filtro-campo" style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-soft)", marginBottom: 5 }}>
              Nombre del perfil
            </span>
            <input
              className="text-input"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={soloLectura}
              maxLength={120}
              required
            />
          </label>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-soft)", marginBottom: 5 }}>
            Descripción (opcional)
          </label>
          <textarea
            className="text-input"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            disabled={soloLectura}
            rows={2}
            maxLength={500}
            style={{ resize: "vertical" }}
          />
        </div>
        <Switch checked={activo} onChange={setActivo} etiqueta={activo ? "Activo" : "Inactivo"} disabled={soloLectura} />
      </div>

      <h4 style={{ marginBottom: 4 }}>Pantallas visibles</h4>
      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginTop: 0, marginBottom: 12 }}>
        Marca a qué pantallas del sistema tiene acceso este perfil. Al marcar una pantalla se despliegan sus
        acciones disponibles.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...PANTALLAS].sort((a, b) => a.orden - b.orden).map((p) => {
          const marcada = pantallasSel.includes(p.slug);
          const accionesDisponibles = PANTALLA_ACCION[p.slug] ?? [];
          const widgetsDisponibles = WIDGETS.filter((w) => w.pantalla === p.slug);

          return (
            <div key={p.slug} className="panel" style={{ padding: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: soloLectura ? "default" : "pointer" }}>
                <input
                  type="checkbox"
                  checked={marcada}
                  disabled={soloLectura}
                  onChange={() => alternarPantalla(p.slug)}
                />
                <strong style={{ fontSize: 13.5 }}>{p.nombre}</strong>
              </label>

              {marcada && accionesDisponibles.length > 0 && (
                <div style={{ marginTop: 10, marginLeft: 26, display: "flex", flexWrap: "wrap", gap: 14 }}>
                  {accionesDisponibles.map((accion) => (
                    <label key={accion} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                      <input
                        type="checkbox"
                        checked={(accionesSel[p.slug] ?? []).includes(accion)}
                        disabled={soloLectura}
                        onChange={() => alternarAccion(p.slug, accion)}
                      />
                      {NOMBRE_ACCION.get(accion) ?? accion}
                    </label>
                  ))}
                </div>
              )}

              {marcada && widgetsDisponibles.length > 0 && (
                <div style={{ marginTop: 10, marginLeft: 26 }}>
                  <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 6 }}>Gráficos visibles</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                    {widgetsDisponibles.map((w) => (
                      <label key={w.slug} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                        <input
                          type="checkbox"
                          checked={widgetsSel.includes(w.slug)}
                          disabled={soloLectura}
                          onChange={() => alternarWidget(w.slug)}
                        />
                        {w.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <p style={{ color: "var(--red)", fontSize: 13, marginTop: 14 }}>{error}</p>
      )}

      {!soloLectura && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 18 }}>
          <button
            type="button"
            className="btn-secundario"
            onClick={() => router.push("/admin/perfiles")}
            disabled={enviando}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-primario" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      )}
    </form>
  );
}
