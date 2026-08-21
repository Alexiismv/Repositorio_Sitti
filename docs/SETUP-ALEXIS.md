# Puesta en marcha — guía para Alexis

Esta guía es para ti, en tu computador, sin jerga. Va en orden: cada paso
supone que el anterior quedó funcionando.

Hay dos formas de recorrerla:

- **A mano**, siguiendo los comandos.
- **Pidiéndoselo a Claude Code**, que puede hacer casi todo solo. Donde Claude
  puede encargarse, verás una cajita **🤖 Pídeselo a Claude** con la frase exacta
  para copiar y pegar.

Lo único que Claude **no** puede hacer por ti son los inicios de sesión: crear
cuentas, poner contraseñas, aceptar términos, resolver captchas. Eso lo haces
tú una vez, y de ahí en adelante Claude sigue solo.

---

## Paso 0 — Lo que necesitas instalado

| Herramienta | Para qué | Cómo |
|---|---|---|
| **Node.js 22 o superior** | Correr la app | https://nodejs.org (descarga LTS) |
| **Git** | Bajar y subir el código | https://git-scm.com/downloads |
| **VS Code** | Editar (opcional pero recomendado) | https://code.visualstudio.com |
| **Claude Code** | El agente que te ayuda | `npm install -g @anthropic-ai/claude-code` |

Verifica que quedó bien:

```bash
node --version   # debe decir v22.x o superior
git --version
```

---

## Paso 1 — Bajar el proyecto y verlo funcionando

```bash
git clone https://github.com/SantiagoDevRel/sitti-panel.git
cd sitti-panel
npm install
npm run dev
```

Abre **http://localhost:3100** en el navegador.

Entra con **`maria.gomez`** / **`demo1234`**.

Deberías ver el Panel General con el mapa de Medellín y unos 9.000 tickets.
**Esos datos son inventados** — están generados a partir de los volúmenes reales
por área que confirmaste, para que todo cuadre entre pantallas. Sirven para
validar el diseño y los cálculos, no son tickets de verdad.

Sal y entra con **`carlos.munera`** / **`demo1234`**: vas a ver muchísimo menos.
Eso es el modelo de permisos funcionando — un coordinador solo ve sus áreas en
sus sedes.

> Si algo falla acá, no sigas: es un problema de instalación, no del proyecto.
> Lo más común es tener una versión vieja de Node.

---

## Paso 2 — Dejar que Claude maneje el navegador por ti

Esto es lo que hace que el resto de la guía sea rápido: con el navegador
conectado, Claude puede entrar a los paneles de Neon, Vercel y MapTiler,
crear los proyectos, copiar las llaves y pegarlas donde van — sin que tú
tengas que ir y venir copiando textos largos.

**Cómo funciona:** se usa un Chrome aparte, dedicado solo a esto, con su propio
perfil. Tú inicias sesión **una vez** en ese Chrome y la sesión queda guardada.
Claude se conecta a ese Chrome, no al que usas para tu día a día.

### 2.1 Instalar Playwright

```bash
npx playwright install chromium
```

### 2.2 Conectar el navegador a Claude Code

```bash
claude mcp add playwright -- npx -y @playwright/mcp@latest --isolated=false --user-data-dir="$HOME/.claude-chrome-perfil"
```

Cierra Claude Code y vuélvelo a abrir para que tome la configuración.

### 2.3 Iniciar sesión una sola vez

Pídele a Claude:

> 🤖 **Pídeselo a Claude**
> "Abre el navegador en https://console.neon.tech, https://vercel.com/login y
> https://cloud.maptiler.com. Déjalos abiertos para que yo inicie sesión."

Cuando abra las páginas, **inicia sesión tú** en las tres (con GitHub es lo más
rápido). Esas sesiones quedan guardadas en ese perfil de Chrome: no hay que
repetirlo.

> ⚠️ **Dos cosas importantes.**
> Ese navegador tiene tus sesiones reales. Dile a Claude en qué páginas puede
> trabajar y no lo dejes suelto en tu correo o en tu banco.
> Y si una página pide un captcha o una verificación en dos pasos, eso lo
> resuelves tú — Claude no debe intentar saltárselo.

---

## Paso 3 — Crear la base de datos (Neon, gratis)

La app guarda los tickets en una base PostgreSQL propia y **no** consulta Jira en
cada clic. Neon da una base gratis de 0.5 GB, que sobra para ~9.000 tickets.

### Con Claude (recomendado)

> 🤖 **Pídeselo a Claude**
> "Crea un proyecto en Neon llamado `sitti-panel`, región AWS US East, y guarda
> la connection string en el archivo `.env` de este repo como `DATABASE_URL`."

Si tienes el **MCP de Neon** conectado, Claude lo hace por API sin abrir el
navegador. Si no, lo hace por el navegador del paso 2. Para conectar el MCP:

```bash
npx add-mcp https://mcp.neon.tech/mcp -a claude-code
```

Reinicia Claude Code y autoriza en la ventana que se abre.

### A mano

1. Entra a https://console.neon.tech y crea cuenta (con GitHub es lo más rápido).
2. **Create project** → nombre `sitti-panel` → región *AWS US East (N. Virginia)*.
3. Copia la **connection string** (empieza con `postgresql://`).
4. En el proyecto:
   ```bash
   cp .env.example .env
   ```
   Abre `.env` y pega la connection string en `DATABASE_URL=`.

### Crear las tablas

```bash
npm run db:schema
```

Debe decir que creó los esquemas y sembró el catálogo (6 gerencias, 18 áreas,
6 sedes, 12 proyectos).

### Crear tu usuario de administrador

```bash
npm run db:seed -- --admin-email alexis --admin-password "una-contraseña-larga-y-tuya" --admin-nombre "Alexis"
```

Guarda esa contraseña en un gestor. **No hay autoregistro**: desde esa cuenta se
crean todas las demás.

---

## Paso 4 — Conectar Jira

### Sacar el token

1. Entra a https://id.atlassian.com/manage-profile/security/api-tokens
   con la cuenta de Atlassian de SITTI.
2. **Create API token** → nómbralo `sitti-panel-lectura`.
3. Cópialo. **Solo se muestra una vez.**
4. Pégalo en `.env`:

```env
JIRA_BASE_URL=https://sitti.atlassian.net
JIRA_EMAIL=tu.correo@sitti.com.co
JIRA_API_TOKEN=el-token-que-copiaste
```

> ⚠️ Esa cuenta debería tener **solo lectura** en los 12 proyectos. La app nunca
> escribe en Jira, pero un token con más permisos de los necesarios es un riesgo
> que no hace falta correr. Si la cuenta que usas puede modificar tickets, pide
> una cuenta de servicio con permisos mínimos.

### Probar antes de cargar nada

```bash
npm run etl -- --dry-run
```

Trae 10 tickets y los imprime, **sin escribir en la base**.

Esto además resuelve el único punto que quedó pendiente del levantamiento: el
**formato exacto de TTFR y TTR**. El dry-run imprime cómo llegan esos dos campos.
Mándale esa salida a Claude:

> 🤖 **Pídeselo a Claude**
> "Este es el resultado del dry-run del ETL: [pega la salida]. Ajusta
> `parsearSla()` en `scripts/etl-jira.ts` para que interprete bien ese formato,
> y anota el hallazgo en `docs/REQUISITOS.md` sección 7 y en `CLAUDE.md` §9."

### Cargar todo

```bash
npm run etl
```

### Apagar el modo demo

En `.env`, cambia:

```env
DEMO_MODE=false
```

Reinicia (`npm run dev`) y entra con **tu** usuario de administrador. Ya no
funcionan las cuentas demo, y la franja amarilla desaparece: estás viendo datos
reales de Jira.

---

## Paso 5 — El mapa (opcional, pero mejor)

El mapa **ya funciona** sin configurar nada: usa OpenStreetMap, que es gratis y
no pide cuenta.

Para producción conviene una llave de **MapTiler** (también gratis, 100.000
teselas al mes — de sobra para 15 personas): el estilo se ve más limpio y tiene
una variante oscura de verdad.

1. Crea cuenta en https://cloud.maptiler.com/
2. **Keys** → copia tu API key.
3. **Restringe la llave a tu dominio** (importante: esa llave viaja al navegador
   de quien use la app, así que sin la restricción cualquiera puede copiarla).
4. En `.env`:
   ```env
   NEXT_PUBLIC_MAPTILER_KEY=tu-llave
   ```

---

## Paso 6 — Publicarlo (Vercel, gratis)

### Con Claude

> 🤖 **Pídeselo a Claude**
> "Despliega este proyecto a mi cuenta de Vercel y configura las variables de
> entorno `AUTH_SECRET`, `DATABASE_URL`, `DEMO_MODE` y `NEXT_PUBLIC_MAPTILER_KEY`
> con los valores de mi `.env`. Genera un `AUTH_SECRET` nuevo."

Si nunca has usado el CLI de Vercel, corre tú este comando primero (es un login
interactivo, Claude no puede hacerlo):

```bash
npx vercel login
```

### A mano

1. Sube el repo a tu GitHub.
2. https://vercel.com/new → importa el repositorio.
3. Antes de dar Deploy, agrega las **Environment Variables**:

| Variable | Valor |
|---|---|
| `AUTH_SECRET` | Genérala con `openssl rand -base64 32` (mínimo 32 caracteres) |
| `DEMO_MODE` | `false` |
| `DATABASE_URL` | La connection string de Neon |
| `NEXT_PUBLIC_MAPTILER_KEY` | Tu llave (si la sacaste) |

4. **Deploy.**

> Las credenciales de Jira **no** van en Vercel: solo las usa el ETL, que corre
> en GitHub Actions (paso 7).

---

## Paso 7 — Que se actualice solo, 2 veces al día

Ya está programado en `.github/workflows/sync-jira.yml` (6:00 a.m. y 2:00 p.m.
hora de Colombia). Solo falta cargar las credenciales en GitHub:

**Settings → Secrets and variables → Actions → New repository secret**, uno por cada:

- `DATABASE_URL`
- `JIRA_BASE_URL`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

Para probarlo sin esperar al horario: pestaña **Actions → Sync Jira → Run workflow**.

---

## Antes de mostrárselo a las gerencias

- [ ] `DEMO_MODE=false` y el ETL corrió bien al menos una vez.
- [ ] `AUTH_SECRET` es un valor generado por ti, no el de ejemplo.
- [ ] Entraste con una cuenta de coordinador y confirmaste que **no** ve lo que no le toca.
- [ ] El token de Jira es de solo lectura.
- [ ] La llave de MapTiler está restringida por dominio.
- [ ] Revisaste que los números del panel cuadren con lo que ves en Jira.

> **Recuerda el contexto:** el proyecto es una sorpresa para las gerencias. La URL
> de Vercel es accesible para quien la tenga — no la compartas en canales abiertos
> hasta que el proyecto sea oficial.

---

## Si algo se rompe

**Lo primero:** pásale el error completo a Claude Code. Literalmente copia y pega
todo lo que salió en la terminal, sin resumir — el mensaje de error suele traer
la solución adentro.

| Síntoma | Qué mirar |
|---|---|
| `npm run dev` no arranca | Versión de Node (`node --version`, debe ser 22+) |
| El panel dice "0 tickets" | ¿Corrió el ETL? Mira `jira_cache.sync_log` en Neon |
| "Usuario o contraseña incorrectos" con `DEMO_MODE=false` | ¿Creaste el usuario con `npm run db:seed`? |
| El mapa sale gris | Sin internet, o la llave de MapTiler está mal / restringida a otro dominio |
| El deploy de Vercel falla | Falta alguna variable de entorno. Mira los build logs completos |
| Un área aparece vacía | Casi siempre es el switch de `customfield_11698` (SMM). Ver `CLAUDE.md` §2.1 |
