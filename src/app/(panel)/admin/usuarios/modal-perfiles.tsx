"use client";

import { useMemo, useState } from "react";

import { Modal } from "@/components/modal";
import { MultiSelectCheckbox } from "@/components/multi-select-checkbox";
import { useToast } from "@/components/toast-provider";
import type { Perfil } from "@/lib/auth/tipos";
import type { PerfilResumen } from "@/lib/auth/usuarios-servicio";

/** Enlace "Perfil" de la tabla (spec 1.2): asigna/quita perfiles, Guardar solo si hubo cambios. */
export function ModalPerfilesUsuario({
  usuario,
  perfilesDisponibles,
  onCerrar,
  onGuardado,
}: {
  usuario: { id: string; nombre: string; perfiles: PerfilResumen[] };
  perfilesDisponibles: Perfil[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const { notificar } = useToast();
  const inicial = useMemo(() => usuario.perfiles.map((p) => p.id).sort(), [usuario]);
  const [seleccionados, setSeleccionados] = useState<string[]>(inicial);
  const [enviando, setEnviando] = useState(false);

  const hayCambios = useMemo(() => {
    const actual = [...seleccionados].sort();
    return actual.length !== inicial.length || actual.some((id, i) => id !== inicial[i]);
  }, [seleccionados, inicial]);

  async function guardar() {
    setEnviando(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${usuario.id}/perfiles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfiles: seleccionados }),
      });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) {
        notificar(datos.error ?? "No se pudieron guardar los perfiles.", "error");
        return;
      }
      notificar(`Perfiles de ${usuario.nombre} actualizados.`, "ok");
      onGuardado();
    } catch {
      notificar("No se pudieron guardar los perfiles.", "error");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo={`Perfiles de ${usuario.nombre}`}
      pie={
        <>
          <button type="button" className="btn-secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </button>
          <button type="button" className="btn-primario" onClick={guardar} disabled={enviando || !hayCambios}>
            {enviando ? "Guardando…" : "Guardar"}
          </button>
        </>
      }
    >
      <MultiSelectCheckbox
        opciones={perfilesDisponibles.map((p) => ({ slug: p.id, nombre: p.nombre }))}
        seleccionados={seleccionados}
        onChange={setSeleccionados}
        placeholderTodos="Sin perfiles asignados"
      />
    </Modal>
  );
}
