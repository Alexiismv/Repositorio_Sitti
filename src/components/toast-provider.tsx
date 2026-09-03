"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type TipoToast = "info" | "ok" | "error";

interface Toast {
  id: number;
  mensaje: string;
  tipo: TipoToast;
}

interface ContextoToast {
  notificar: (mensaje: string, tipo?: TipoToast) => void;
}

const Ctx = createContext<ContextoToast>({ notificar: () => {} });

const DURACION_MS = 4000;

/**
 * Notificaciones tipo toast (spec 1.3: "se muestra un mensaje de confirmación
 * al restablecer una contraseña"). Se monta una vez en `(panel)/layout.tsx`
 * envolviendo `{children}`.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const contador = useRef(0);

  const notificar = useCallback((mensaje: string, tipo: TipoToast = "info") => {
    const id = ++contador.current;
    setToasts((actual) => [...actual, { id, mensaje, tipo }]);
    setTimeout(() => {
      setToasts((actual) => actual.filter((t) => t.id !== id));
    }, DURACION_MS);
  }, []);

  return (
    <Ctx.Provider value={{ notificar }}>
      {children}
      <div className="toast-contenedor" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tipo}`}>
            {t.mensaje}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
