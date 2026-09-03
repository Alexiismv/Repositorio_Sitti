"use client";

import { useState } from "react";

import { Modal } from "@/components/modal";
import { useToast } from "@/components/toast-provider";

/** Ícono de llave de la tabla (spec 1.3): confirmación Sí/No antes de restablecer. */
export function ModalRestablecerPassword({
  usuario,
  onCerrar,
  onHecho,
}: {
  usuario: { id: string; nombre: string };
  onCerrar: () => void;
  onHecho: () => void;
}) {
  const { notificar } = useToast();
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setEnviando(true);
    try {
      const res = await fetch(`/api/admin/usuarios/${usuario.id}/restablecer-password`, { method: "POST" });
      const datos = await res.json().catch(() => ({}));
      if (!res.ok) {
        notificar(datos.error ?? "No se pudo restablecer la contraseña.", "error");
        return;
      }
      notificar(
        `Contraseña de ${usuario.nombre} restablecida a "admin". Deberá cambiarla en su próximo inicio de sesión.`,
        "ok",
      );
      onHecho();
    } catch {
      notificar("No se pudo restablecer la contraseña.", "error");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      abierto
      onCerrar={onCerrar}
      titulo="Restablecer contraseña"
      pie={
        <>
          <button type="button" className="btn-secundario" onClick={onCerrar} disabled={enviando}>
            No
          </button>
          <button type="button" className="btn-primario" onClick={confirmar} disabled={enviando}>
            {enviando ? "Restableciendo…" : "Sí, restablecer"}
          </button>
        </>
      }
    >
      <p style={{ margin: 0 }}>
        ¿Está seguro que desea restablecer la contraseña de <strong>{usuario.nombre}</strong>? Quedará en{" "}
        <span className="mono">admin</span> y deberá definir una nueva la próxima vez que inicie sesión.
      </p>
    </Modal>
  );
}
