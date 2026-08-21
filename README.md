# SITTI — Panel de Gestión

Panel de indicadores de la operación de movilidad de Medellín, sobre Jira
Service Management (JSM). Seguimiento por **sede**, **gerencia**, **área** y
**persona**, con metas de SLA (TTR / TTFR) y alertas de lo que está frenado.

> 🤖 **¿Eres un agente de IA?** Lee [`CLAUDE.md`](CLAUDE.md) — ahí está el
> contexto completo, las reglas duras y el paso a paso de configuración.
> [`AGENTS.md`](AGENTS.md) apunta al mismo lugar.

---

## Correrlo en 2 comandos

```bash
npm install
npm run dev
```

→ **http://localhost:3100**

| Usuario | Contraseña | Rol |
|---|---|---|
| `maria.gomez` | `demo1234` | Gerente — ve todo |
| `carlos.munera` | `demo1234` | Coordinador — solo sus áreas y sedes |
| `admin` | `demo1234` | Administrador — gestión de usuarios |

No necesitas base de datos, ni cuenta de Jira, ni API key de mapas. La app
arranca en **modo demo** con ~9.000 tickets generados localmente a partir de los
volúmenes 2026 reales por área.

Entra primero con `maria.gomez` y después con `carlos.munera`: la diferencia
entre las dos vistas es el modelo de permisos funcionando de verdad.

---

## Qué incluye

**Login** — el prototipo aprobado, tal cual: panel de marca con radar animado y
ticker de gerencias, formulario a la derecha. Sesión de 2 horas.

**Panel General** — resumen 2026 con semáforo de cumplimiento, **mapa de sedes**
sobre la silueta real de Medellín, tendencia de creados vs. resueltos,
comparativo semana a semana y el ranking de impacto por gerencia.

**Mapa de sedes** — las 6 sedes reales georreferenciadas. Pasas el mouse sobre
un pin y ves su detalle; haces clic y la fijas; el botón **Todas** vuelve a la
vista consolidada. En cada sede: histórico por año/mes/semana/día, total,
pendientes, top 5 más antiguos sin resolver, top 5 más comentados, tipo de
requerimiento más solicitado y portal de JSM más usado.

**Navegación en 3 niveles** — Gerencias → Áreas de esa gerencia → Detalle
operativo del área, con tablero por estado, tickets estancados y la tabla
completa con semáforo por ticket.

**Personas** — carga por persona asignada y, sobre todo, dónde se está
acumulando lo estancado.

**Reportes** — filtros dinámicos por fecha, gerencia, área, sede, persona,
estado y tipo. Los filtros viven en la URL: puedes pegar el enlace en el chat de
una reunión y quien lo abra ve el mismo reporte.

**Administración** — usuarios, roles y el modelo de permisos anidado
(sede → áreas dentro de esa sede).

**Refrescar** — botón en la barra superior (Gerente y Administrador) que trae
de Jira lo que cambió y repinta el panel en segundos, sin esperar a la
sincronización programada.

**Modo claro / oscuro** — botón en la barra superior. Arranca en oscuro y
recuerda tu elección.

---

## Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Estilos | Tailwind v4 + CSS propio (paleta y tipografía de marca SITTI) |
| Mapa | MapLibre GL + OpenStreetMap (sin API key) · MapTiler opcional |
| Gráficas | Recharts |
| Sesión | JWT firmado en cookie httpOnly (`jose`), 2 h |
| Base de datos | PostgreSQL — pensado para Neon (plan gratuito) |
| Despliegue | Vercel (plan gratuito) · botón Refrescar + sync opcional en GitHub Actions |

---

## Estado y siguiente paso

Todas las pantallas y todos los cálculos funcionan. Lo que falta es enchufarlo a
las cuentas reales, y eso requiere credenciales que solo tiene Alexis:

1. Crear la base en **Neon** y aplicar el esquema → `CLAUDE.md` §4
2. Conectar **Jira** y correr el ETL → `CLAUDE.md` §5
3. (Opcional) llave gratuita de **MapTiler** → `CLAUDE.md` §6
4. Desplegar en **Vercel** → `CLAUDE.md` §7

Cada paso está escrito para poder seguirse a mano o pedírselo a Claude Code.

---

## Documentación

| Archivo | Qué contiene |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Contexto, reglas duras y configuración paso a paso |
| [`docs/REQUISITOS.md`](docs/REQUISITOS.md) | Levantamiento de requisitos — fuente de verdad del negocio |
| [`docs/SETUP-ALEXIS.md`](docs/SETUP-ALEXIS.md) | La misma puesta en marcha, explicada sin jerga |
| [`db/schema.sql`](db/schema.sql) | Esquemas `jira_cache`, `catalogo` y `auth` |
| [`docs/prototipos/`](docs/prototipos/) | Los HTML originales, como referencia de diseño |
