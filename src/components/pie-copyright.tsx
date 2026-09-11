/**
 * Crédito de autoría, visible en las pantallas autenticadas y en el flujo de
 * cambio de contraseña obligatorio — pedido explícito de Alexis. En el login
 * NO va: Alexis pidió quitarlo de esa pantalla.
 * Componente compartido para no repetir el texto/año en cada pantalla.
 */
export function PieCopyright({ className }: { className?: string }) {
  return (
    <p className={className} style={{ margin: 0 }}>
      Desarrollado por Alexis Martinez © {new Date().getFullYear()}
    </p>
  );
}
