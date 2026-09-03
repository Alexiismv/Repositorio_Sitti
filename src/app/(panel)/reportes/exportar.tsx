import { ExportarEnlaces } from "@/components/ui";
import type { ReportesSearchParams } from "@/lib/reportes-filtros";

/**
 * La query string es la misma que ya trae la URL del reporte, para que el
 * archivo descargado respete exactamente los mismos filtros que se ven en
 * pantalla.
 */
export function BotonesExportar({ searchParams }: { searchParams: ReportesSearchParams }) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    // Área permite varias a la vez: si se quedara solo con v[0] (como antes),
    // el Excel/PDF exportado filtraría distinto de lo que se ve en pantalla.
    for (const val of Array.isArray(v) ? v : [v]) {
      if (val) qs.append(k, val);
    }
  }
  const query = qs.toString();

  return (
    <ExportarEnlaces
      excelHref={`/api/export/reportes/excel${query ? `?${query}` : ""}`}
      pdfHref={`/api/export/reportes/pdf${query ? `?${query}` : ""}`}
    />
  );
}
