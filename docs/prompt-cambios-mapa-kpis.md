# Prompt para Claude Code — Mapa de sedes y KPIs del Panel General (SITTI)

Contexto: prompt listo para pegar en Claude Code, ejecutado dentro del repo `Repositorio_Sitti`. Ya localicé los archivos y funciones exactas que hay que tocar para cada punto — verifícalos antes de editar por si el código cambió desde que se escribió este prompt.

---

## Instrucción para el asistente de desarrollo

Implementa los siguientes 8 cambios sobre el Panel General y el mapa de sedes. Van de más simple a más involucrado; los puntos 5-8 tocan tanto UI como la capa de datos/filtros. Respeta los patrones que el código ya usa (por ejemplo, `soloIncumplidos` como precedente para nuevos filtros) en vez de inventar uno nuevo.

### 1. Clic en un pin del mapa: alternar selección (toggle)

Archivo: `src/components/mapa/mapa-sedes.tsx`, dentro del `useEffect` que crea los pines (~línea 176), función `fijar`:

```ts
const fijar = () => {
  setFijada(sede.slug);
  setEnHover(null);
};
```

Cámbiala para que, si la sede ya estaba fijada, un segundo clic la desfije y vuelva a "Todas":

```ts
const fijar = () => {
  setFijada((actual) => (actual === sede.slug ? TODAS : sede.slug));
  setEnHover(null);
};
```

Esto aplica tanto al `click` como al `keydown` (Enter/Espacio) del pin, porque ambos llaman a `fijar()`.

**Nota de alcance:** los botones de la barra superior del mapa (`mp-selector`, función `seleccionarDesdeBarra`) NO quedan con toggle — seleccionan directo. Si más adelante quieres el mismo comportamiento ahí, es el mismo patrón, pero no lo apliques sin que Alexis lo confirme: hoy un clic repetido en el botón de una sede ya fijada simplemente la re-centra, y cambiar eso es una decisión de UX aparte.

### 2. Clic en el mapa fuera de cualquier pin: volver a "Todas"

Mismo archivo. Hoy no hay ningún listener de clic sobre el mapa en sí, solo sobre los pines. Agrega uno en el `useEffect` de inicialización (~línea 83-148), después de `m.on("load", ...)`:

```ts
m.on("click", () => {
  setFijada(TODAS);
  setEnHover(null);
});
```

Esto es seguro sin lógica adicional para "detectar que no había pin debajo": los marcadores de MapLibre son elementos DOM independientes del canvas (viven en un contenedor aparte, no dentro de `canvas`), así que un clic sobre un pin nunca dispara el evento `click` del mapa — el listener de arriba solo se activa cuando el clic cae en zona vacía del lienzo. No hace falta condicionar por `fijada !== TODAS`; si ya estaba en "Todas" el `setState` es un no-op.

### 3. Renombrar "Cumplimiento TTFR (4h)" → "Primera respuesta ticket"

Archivo: `src/app/(panel)/page.tsx`, arreglo de `kpis` dentro de `<KpiStrip>` (~línea 81):

```ts
label: `Cumplimiento TTFR (${META_TTFR_HORAS}h)`,
```

→

```ts
label: "Primera respuesta ticket",
```

### 4. Renombrar "Cumplimiento TTR" → "Tiempo Resolución Ticket"

Mismo archivo, mismo arreglo (~línea 88):

```ts
label: "Cumplimiento TTR",
```

→

```ts
label: "Tiempo Resolución Ticket",
```

**Nota de consistencia (opcional, no pedida explícitamente):** más abajo en la misma página, la tabla "Salud del SLA" tiene filas rotuladas "TTFR — primera respuesta" y "TTR — resolución" (~líneas 144 y 151). No las toqué porque no se pidió, pero si quieres que todo el panel hable con el mismo vocabulario, son los mismos textos a ajustar.

### 5. KPI "Primera respuesta ticket": mostrar tiempo real vs. meta, no porcentaje

Hoy el `valor` de esta tarjeta es `porcentaje(r.cumplimientoTtfr)` (ej. "80%"). Alexis quiere ver el cumplimiento **en términos de tiempo** contra la meta de 4 horas, no como porcentaje de tickets.

`resumen()` (en `src/lib/metricas.ts`) ya calcula `ttfrPromedioHoras` — el promedio real en horas —, así que no hace falta una métrica nueva. Cambia solo cómo se muestra en `src/app/(panel)/page.tsx`:

```ts
{
  label: "Primera respuesta ticket",
  valor: `${r.ttfrPromedioHoras.toLocaleString("es-CO")}h`,
  cap: `Meta: ${META_TTFR_HORAS}h · toda prioridad`,
  color: r.cumplimientoTtfr >= 90 ? "#3FA9AC" : "#F7A82C",
  alerta: r.cumplimientoTtfr < 80,
}
```

El color y la alerta siguen basados en `cumplimientoTtfr` (el % de tickets que sí cumplió) — eso no cambia, solo cambia qué número ve el usuario como valor principal. Si prefieres que el propio color compare directamente el promedio contra la meta (`r.ttfrPromedioHoras > META_TTFR_HORAS`) en vez del %, es una variante razonable; queda a tu criterio, pero documenta cuál usaste.

### 6. KPI "Tiempo Resolución Ticket": tiempo vs. meta, desagregado por prioridad con semáforos

Este es el punto más grande. Tiene dos partes:

**6a. La tarjeta KPI principal** — mismo tratamiento que el punto 5, mostrando el promedio general en vez del %:

```ts
{
  label: "Tiempo Resolución Ticket",
  valor: `${r.ttrPromedioHoras.toLocaleString("es-CO")}h`,
  cap: "Meta por prioridad · Alta 4h · Media 8h · Baja 24h",
  color: r.cumplimientoTtr >= 90 ? "#3FA9AC" : "#F7A82C",
  alerta: r.cumplimientoTtr < 80,
}
```

(El `cap` ya decía esto — no cambia.)

**6b. Desagregado por prioridad con semáforo** — Alexis pide poder ver el cumplimiento de cada meta (Alta 4h, Media 8h, Baja 24h) por separado. `META_TTR_HORAS` en `src/lib/catalogo.ts` ya está tipada como `Record<Prioridad, number>` con esas tres metas, así que solo falta agregar la función que agrupa:

En `src/lib/metricas.ts`, junto a `resumen()`, agrega:

```ts
export interface TtrPorPrioridad {
  prioridad: Prioridad;
  metaHoras: number;
  promedioHoras: number;
  cumplimiento: number; // % de tickets de esa prioridad que cumplió su meta
  semaforo: "verde" | "amarillo" | "rojo";
}

export function cumplimientoTtrPorPrioridad(tickets: Ticket[]): TtrPorPrioridad[] {
  return (["Alta", "Media", "Baja"] as Prioridad[]).map((prioridad) => {
    const grupo = tickets.filter((t) => t.prioridad === prioridad && t.ttrHoras !== null);
    const metaHoras = META_TTR_HORAS[prioridad];
    const ok = grupo.filter((t) => !t.ttrIncumplido).length;
    const cumplimiento = grupo.length ? Math.round((ok / grupo.length) * 100) : 0;
    const promedioHoras = grupo.length
      ? Math.round((grupo.reduce((a, t) => a + (t.ttrHoras ?? 0), 0) / grupo.length) * 10) / 10
      : 0;
    return {
      prioridad,
      metaHoras,
      promedioHoras,
      cumplimiento,
      semaforo: cumplimiento >= 90 ? "verde" : cumplimiento >= 70 ? "amarillo" : "rojo",
    };
  });
}
```

(Reutiliza el mismo vocabulario "verde/amarillo/rojo" que ya usa `semaforo()` un poco más abajo en el archivo — no inventes una escala nueva. Ajusta los cortes 90/70 si Alexis prefiere otros umbrales; hoy el resto del panel usa 80/90 como cortes, así que revísalo con ella antes de fijarlos.)

En `src/app/(panel)/page.tsx`, dentro del panel "Salud del SLA" (la tabla que ya tiene filas de TTFR/TTR/Resueltos/Cancelados), reemplaza la única fila de TTR por tres filas — una por prioridad — con un punto de color como semáforo:

```tsx
{cumplimientoTtrPorPrioridad(tickets).map((p) => (
  <tr key={p.prioridad}>
    <td>TTR — {p.prioridad} (meta {p.metaHoras}h)</td>
    <td className="num">{p.promedioHoras.toLocaleString("es-CO")} h</td>
    <td className="num">
      <span
        aria-hidden="true"
        style={{
          display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginRight: 6,
          background: p.semaforo === "verde" ? "var(--green, #3FA9AC)" : p.semaforo === "amarillo" ? "#F7A82C" : "var(--red)",
        }}
      />
      {porcentaje(p.cumplimiento)}
    </td>
  </tr>
))}
```

Revisa si existe una variable CSS `--green` en `globals.css`/`shell.css` antes de usarla; si no existe, usa el hex de la paleta que ya se repite en el archivo (`#3FA9AC`) para mantener consistencia con el resto del panel.

### 7. "Pendientes Totales" → el texto "197 sin movimiento hace 5+ días" debe ser un link

Hoy ese texto es el `cap` de la tarjeta KPI (`src/app/(panel)/page.tsx`, ~línea 76) y `KpiStrip`/`Kpi` (`src/components/ui.tsx`) no soportan que el `cap` sea un enlace — solo texto plano. Hace falta tocar tres capas: el tipo de filtro, el componente de UI, y la tarjeta.

**a) Nuevo filtro `soloEstancados`, siguiendo el mismo patrón que `soloIncumplidos`:**

En `src/lib/data/provider.ts`:
- Añade `soloEstancados?: boolean;` a la interfaz `Filtros`.
- Importa `DIAS_ESTANCADO_DEFAULT` desde `@/lib/catalogo` (falta en el import de la línea 16).
- En `cumpleFiltros()`, junto al `if (f.soloIncumplidos...)`, agrega:
  ```ts
  if (f.soloEstancados) {
    const abierto = t.categoriaEstado !== "resuelto" && t.categoriaEstado !== "cancelado";
    if (!(abierto && t.diasSinActualizar >= DIAS_ESTANCADO_DEFAULT)) return false;
  }
  ```

En `src/lib/reportes-filtros.ts`, dentro de `filtrosDesdeSearchParams`, agrega el mapeo del query param:
```ts
soloEstancados: uno(sp.estancado) === "1",
```
Y opcionalmente, en `describirFiltros`, para que el PDF/Excel exportado también lo describa:
```ts
if (uno(sp.estancado) === "1") partes.push("Solo estancados (5+ días sin movimiento)");
```

**b) `Kpi`/`KpiStrip` deben poder renderizar el `cap` como link.** En `src/components/ui.tsx`, extiende la interfaz `Kpi`:
```ts
export interface Kpi {
  label: string;
  valor: string;
  cap?: string;
  capHref?: string;
  color?: string;
  alerta?: boolean;
}
```
Y en el render, si viene `capHref`, envuelve el `cap` en `<Link>` (ya puedes importar `Link` de `next/link` — el archivo aún no lo importa, agrégalo arriba):
```tsx
{k.cap && (k.capHref
  ? <Link href={k.capHref} className="cap cap-link">{k.cap}</Link>
  : <div className="cap">{k.cap}</div>
)}
```
`KpiStrip` sigue siendo un Server Component — `Link` no lo obliga a ser `"use client"`.

**c) Usar el link en la tarjeta**, en `src/app/(panel)/page.tsx`:
```ts
{
  label: "Pendientes Totales",
  valor: numero(r.pendientes),
  cap: `${numero(r.estancados)} sin movimiento hace 5+ días`,
  capHref: "/reportes?estancado=1",
  color: "#EC623B",
  alerta: r.estancados > 0,
}
```

Agrega un estilo mínimo para `.cap-link` en el CSS del shell (subrayado o color de acento al hover) para que se note que es clickeable, sin que compita visualmente con el resto de la tarjeta.

### 8. "Pendientes" en el panel de sede: agregar "Ver tickets" filtrado por sede (o por "Todas")

Archivo: `src/components/mapa/panel-sede.tsx`, dentro del bloque `mp-kpi` de "Pendientes" (~línea 70-75). `Link` ya está importado en este archivo.

```tsx
<div className="mp-kpi">
  <div className="l">Pendientes</div>
  <div className="v" style={{ color: detalle.pendientes ? "var(--red)" : undefined }}>
    {numero(detalle.pendientes)}
  </div>
  {detalle.pendientes > 0 && (
    <Link
      href={esConsolidado ? "/reportes?estado=pendientes" : `/reportes?estado=pendientes&sede=${detalle.slug}`}
      className="mp-kpi-link"
    >
      Ver tickets →
    </Link>
  )}
</div>
```

`esConsolidado` ya es una prop del componente (`true` cuando está en "Todas"), así que el link cambia solo según lo que esté fijado en el mapa — no hace falta lógica nueva de estado.

**Ojo, no lo confundas con el link que ya existe** al final de la tarjeta ("Ver todos los tickets de esta sede →", ~línea 149-151): ese va a `/reportes?sede=...` sin filtrar por estado (muestra TODOS los tickets de la sede). El nuevo de este punto es específico a pendientes (`estado=pendientes`) y vive dentro de la tarjeta de KPI, no al final del panel.

Revisa `mapa.css` (`src/components/mapa/mapa.css`) para ver si ya existe una clase de enlace pequeño reutilizable dentro de `.mp-kpis`; si no, crea `.mp-kpi-link` con un estilo discreto (texto pequeño, color de acento) consistente con el resto de la tarjeta — no es necesario que se vea como un botón.

---

## Verificación al terminar

- Clic en un pin lo fija; clic de nuevo en el mismo pin vuelve a "Todas". Clic en zona vacía del mapa también vuelve a "Todas".
- Las dos tarjetas renombradas (puntos 3-4) se ven bien en `sm` (el `KpiStrip` reduce el tamaño de fuente si el valor tiene más de 9 caracteres — revisa que los nuevos valores en horas no disparen ese caso de forma rara).
- Los valores de las tarjetas 5 y 6 muestran horas, no porcentaje, y el semáforo/alerta se sigue viendo coherente con el resto del panel.
- La tabla "Salud del SLA" muestra 3 filas de TTR (Alta/Media/Baja) con su semáforo, en vez de una sola fila genérica.
- El link de "Pendientes Totales" lleva a `/reportes?estancado=1` y la tabla de tickets ahí realmente se reduce a los estancados (pruébalo con y sin otros filtros combinados en la URL).
- El link "Ver tickets" del panel de sede respeta la sede fijada, y cuando está en "Todas" no agrega `sede=` a la URL.
- Prueba todo con `npm run dev` en modo demo (`DEMO_MODE=true`) antes de tocar nada de producción.
