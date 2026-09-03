"use client";

/** Toggle Activo/Inactivo (spec 2.1: "Estado (Activo/Inactivo) — obligatorio que sea visible"). */
export function Switch({
  checked,
  onChange,
  etiqueta,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  etiqueta?: string;
  disabled?: boolean;
}) {
  return (
    <label className="switch" style={disabled ? { opacity: 0.6, cursor: "not-allowed" } : undefined}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="switch-pista" />
      {etiqueta && <span className="switch-texto">{etiqueta}</span>}
    </label>
  );
}
