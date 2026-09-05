/**
 * Crédito de autoría, visible en toda la app (login, pantallas autenticadas,
 * flujo de cambio de contraseña obligatorio) — pedido explícito de Alexis.
 * Componente compartido para no repetir el texto/año en cada pantalla.
 */
export function PieCopyright({ className }: { className?: string }) {
  return (
    <p className={className} style={{ margin: 0 }}>
      Desarrollado por Alexis Martinez © {new Date().getFullYear()}
    </p>
  );
}
