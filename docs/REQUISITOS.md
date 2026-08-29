# SITTI — App de Gestión Administrativa
## Documento de Levantamiento de Requisitos (v0.1)

> Este documento es la "fuente de verdad" del proyecto. Lo iremos llenando juntos, sección por sección, antes de empezar a desarrollar. Donde no tengas la respuesta aún, escribe "TBD" y seguimos.

---

## 1. Contexto y objetivo del proyecto

- **Problema a resolver:** La visualización de informes de gestión de la herramienta ITSM (JSM) que soporta la operación de la Secretaría de Movilidad de Medellín, distribuida en varias sedes de atención.
- **Objetivo de negocio:** Que coordinadores y gerentes tengan a la mano seguimiento por sede, por área y **por persona individual**, para identificar tickets con TTR/TTFR altos y poder apoyar a desbloquear impedimentos, detectar patrones de algo que esté fallando, y medir el impacto de decisiones en el tiempo. También que puedan generar sus propios reportes vía filtros dinámicos para reuniones y toma de decisiones, y auditar a las personas a su cargo.
- **Alcance inicial (MVP) — confirmado, debe estar sí o sí:**
  - Login
  - Pantalla de inicio (post-login) con **mapa de Medellín en silueta**, interactivo: al **pasar el mouse (hover)** sobre una sede se muestra su info básica — histórico por año/mes/semana/día, total de tickets, tickets pendientes, top 5 tickets más antiguos sin resolver, top 5 con más comentarios, tipo de requerimiento más solicitado en esa sede, y portal de JSM más utilizado por esa sede.
  - ⚠️ **Cambio de interacción respecto al prototipo actual:** el mapa se diseñó con **clic** para seleccionar sede; el requisito real es **hover** (pasar el mouse). Hay que ajustar el prototipo — y definir un equivalente táctil para móvil/tablet, donde "hover" no existe (probablemente tap, igual que está ahora).
- **Contexto de negocio (confirmado, sitti.com.co):** SITTI trabaja con la Secretaría de Movilidad de Medellín en la gestión de la movilidad de la ciudad, con foco en eficiencia, sostenibilidad y seguridad vial de los ciudadanos. Esto es coherente con las áreas identificadas (Multas, Fotodetección, Aseguramiento Contravencional, Cobro Coactivo, Radicación, Cartera, etc.) — el negocio opera sobre el ciclo de vida de infracciones de tránsito: desde la detección/generación del comparendo hasta su gestión legal, notificación y cobro.
- **Propósito/misión (declaración oficial de SITTI):**
  > "Nos mueve impactar la calidad de vida de los ciudadanos a través de soluciones tecnológicas, apostándole a una mejor movilidad. Nos mueve Medellín, sus familias y habitantes. Nos mueve brindar un trato humano; somos una empresa conformada por personas, que está al servicio de los ciudadanos."
  - Tres pilares: **Tecnología**, **Medellín/ciudadanía**, **Trato humano**. Útil como tono de voz para textos de la app (login, mensajes de bienvenida, estados vacíos) — cercano, humano, orientado a impacto ciudadano, no corporativo/frío.
- Sede principal: Carrera 64 C No. 72-58, Caribe, Medellín.
- **Áreas de servicio de SITTI:** 17 áreas identificadas en total (ver detalle y estrategia de despliegue en sección 4). El MVP arrancará con un subconjunto piloto, no las 17 a la vez.

## 2. Usuarios y roles

| Rol | Qué puede ver | Qué puede hacer | Cantidad aprox. de usuarios |
|---|---|---|---|
| Gerente | Acceso a **todas** las áreas/gerencias (no restringido). La UI permite filtrar dinámicamente para ver todas a la vez o enfocarse en una/varias específicas. | | |
| Coordinador | ⚠️ **Corrección:** acceso **restringido** solo a su(s) área(s) o sede(s) asignada(s) — no a todas como se había registrado antes. | | |
| Administrador | Rol nuevo confirmado — gestiona usuarios del sistema (creación, edición, asignación de área/sede a coordinadores). | Crear/editar/desactivar usuarios manualmente. | 1 (el usuario, inicialmente) |

**✅ Confirmado:**
- Sí hay jerarquía: **Gerente ve todo**; **Coordinador ve solo sus áreas y/o sedes asignadas**.
- **Implicación de esquema:** se necesita una tabla de asignación `usuario_area` y/o `usuario_sede` (relación muchos-a-muchos) para saber qué puede ver cada coordinador — no basta con el rol solo.
- **Gestión de usuarios:** dentro de la misma app (no directorio externo por ahora) — el Administrador crea las cuentas manualmente. Coherente con la decisión de usuario/contraseña propio del MVP (sección 3); Azure AD queda como fase futura.

⚠️ **Pendiente:** definir si un Coordinador se asigna por Área, por Sede, o ambas combinadas (ej. "Coordinador de Cartera en la sede Caribe" vs. "Coordinador de toda el área Cartera en cualquier sede").

**✅ Resuelto — modelo de permisos granular confirmado:**
- Desde el perfil/configuración de cada usuario, el Administrador elige: rol (Gerente/Coordinador), qué **sedes** puede ver (una, varias, o todas), y — dentro de cada sede — qué **áreas** puede ver (una, varias, o todas). Es decir, la visibilidad de área está **anidada dentro de la sede** (un coordinador podría ver "Cartera" solo en la sede Caribe, y "Multas" solo en Poblado, por ejemplo).
- **Implicación de esquema:** en vez de dos tablas independientes (`usuario_area` y `usuario_sede`), se necesita una tabla de permisos que capture la combinación: `usuario_permiso` (`usuario_id`, `sede_id`, `area_id`) — cada fila es "este usuario puede ver esta área dentro de esta sede". Un flag `ve_todas_sedes` / `ve_todas_areas` en el usuario (o la ausencia de restricciones) representa el caso "puede ver todas".

## 3. Autenticación y seguridad

- **Decisión (revisada): Usuario y contraseña propios para el MVP.** El proyecto es una sorpresa para las gerencias — usar SSO con Azure AD implicaría solicitar permisos formales de IT/Azure antes de tiempo, lo cual no es viable aún. Se implementa autenticación propia (usuario/contraseña con hash seguro) para el lanzamiento inicial.
- **Fase futura:** migrar a SSO con Azure AD (Microsoft Entra ID) una vez el proyecto sea oficial y se gestionen los permisos correspondientes con IT. El diseño del login ya contempla esta transición (estructura del formulario reemplazable por botón SSO sin rediseñar la pantalla).
- Atlassian **aún no está conectado a Azure AD** — no aplica por ahora dado el cambio anterior; queda como nota para cuando se active SSO.
- **✅ Confirmado:**
  - MFA: **no obligatorio** por ahora.
  - Expiración de sesión: **2 horas**.
  - **Dos logs distintos requeridos:** log de **auditoría** (quién hizo qué, cuándo — accesos, cambios) y log de **errores del sistema** (fallos técnicos, para soporte/debug). Son tablas/streams separados con propósitos distintos.
  - Cuentas: **creación manual por el Administrador** (ver sección 2) — sin autoregistro.

⚠️ **Hallazgo operativo (27 ago 2026):** el login real contra Postgres estuvo
roto en Vercel (Preview y Producción) por dos variables de entorno mal
configuradas — `DEMO_MODE` guardada como cadena vacía en vez de `"false"`
(por lo que el login seguía usando las cuentas demo en memoria) y, una vez
corregido eso, `AUTH_SECRET` ausente/inválido (bloqueaba la firma de la
cookie de sesión). Ninguna de las dos fallas era visible revisando
`vercel env ls` ni el resultado del build — solo se detectaron al intentar un
login real y leer `vercel logs`. Detalle técnico completo y la lección
operativa en `CLAUDE.md` §7.3. Para cualquier cambio futuro a `DEMO_MODE` o
`AUTH_SECRET`: siempre validar con un login real después de redesplegar.

## 4. Indicadores de gestión (KPIs) por área

**✅ Mapeo Gerencia → Área CONFIRMADO** (reemplaza la hipótesis anterior):

| Gerencia | Áreas que agrupa | Volumen 2026 (recalculado) |
|---|---|---:|
| **Experiencia de Servicio** | Servicio, Experiencia de Servicio, Gestión de Notificaciones | **3,665** |
| **Operación Contravencional** | Aseguramiento Contravencional, Radicación, Fotodetección, CAD, Aseguramiento Contractual | **3,171** |
| **Jurídica** | Gestión Legal, Gestión Jurídica de Cobro | **1,035** |
| **Financiera** | Cartera, Financiera | **911** |
| **Conexión de Soluciones** | Conexión de Soluciones | **28** |
| **Experiencia y Bienestar** | Experiencia y Bienestar | **4** |
| *(sin gerencia)* | Otras, *(sin nombre)*, Gerencia General, Digitalización | 224 |

⚠️ **Cambio importante respecto al prototipo ya construido:** el ranking de gerencias que se ve hoy en `sitti-gerencias-prototipo.html` (Operación Contravencional #1 con 1,981; Jurídica #2; Experiencia de Servicio #3 con solo 276) **ya no es correcto**. Con el mapeo real, **Experiencia de Servicio pasa a ser la gerencia de mayor volumen** (3,665, porque ahora incluye "Servicio", la ex-área individual más grande), seguida de cerca por Operación Contravencional (3,171). Hay que actualizar las tarjetas, las barras de proporción y el detalle de Nivel 2 con estos números reales.

**✅ Enfoque de KPIs (aclarado — reemplaza el borrador anterior):**
- Los KPIs de negocio **no se calculan con fórmulas por área** como se había hipotetizado. Los dos indicadores centrales ya vienen calculados directo desde Jira como campos:
  - **TTFR — Tiempo de Primera Respuesta** (`customfield_10044`)
  - **TTR — Tiempo de Resolución** (`customfield_10043`)
- **✅ Metas SLA confirmadas:**
  - **TTFR: 4 horas para todos los tickets**, sin distinción de prioridad.
  - **TTR: depende de la prioridad del ticket** — Baja: 24h hábiles · Media: 8h hábiles · Alta: 4h hábiles.
  - Estas metas son la base del semáforo rojo/verde: un ticket "en rojo" es aquel cuyo TTR/TTFR ya superó la meta según su prioridad.
  - ⚠️ **Punto por confirmar:** el formato exacto en que estos dos campos llegan por API (ver aclaración al inicio de esta respuesta) — probablemente un objeto de SLA de Jira, no un número/fecha plano.
- **Área, Sede, Gerencia y Persona (asignado) son dimensiones de desagregación**, no fórmulas distintas — es decir, el mismo TTR/TTFR se puede filtrar/agrupar por cualquiera de esos ejes, no hay que inventar una métrica distinta por cada área.
- El campo "Área" en sí mismo solo debe soportar un filtro de estado: **Todos / Pendientes / Resueltos**.
- **Frecuencia de actualización confirmada: 2 veces al día** (no tiempo real) — esto simplifica bastante el diseño del ETL (ver sección 7): no hace falta sync continuo, con un cron 2x/día es suficiente para el caso de uso real.
- **Alertas:** cuando un KPI se sale de rango, se resalta en **color rojo** (confirmado en sección 5).

**Estrategia recomendada:** con el mapeo ya confirmado, no hace falta la estrategia de "pilotos" que planteamos antes — se puede construir directo con los datos reales de las 6 gerencias.

### Las 17 áreas (datos 2026, volumen de casos/tickets) — referencia

| # | Área | Volumen 2026 | Gerencia |
|---|---|---:|---|
| 1 | Servicio | 3,214 | Experiencia de Servicio |
| 2 | Aseguramiento Contravencional | 1,981 | Operación Contravencional |
| 3 | Gestión Legal | 997 | Jurídica |
| 4 | Radicación | 773 | Operación Contravencional |
| 5 | Cartera | 689 | Financiera |
| 6 | Fotodetección | 350 | Operación Contravencional |
| 7 | Experiencia de Servicio | 276 | Experiencia de Servicio |
| 8 | Financiera | 222 | Financiera |
| 9 | Gestión de Notificaciones | 175 | Experiencia de Servicio |
| 10 | Otras | 124 | *(sin gerencia)* |
| 11 | *(sin nombre — pendiente de identificar origen)* | 97 | *(sin gerencia)* |
| 12 | CAD | 40 | Operación Contravencional |
| 13 | Gestión Jurídica de Cobro | 38 | Jurídica |
| 14 | Conexión de Soluciones | 28 | Conexión de Soluciones |
| 15 | Aseguramiento Contractual | 27 | Operación Contravencional |
| 16 | Experiencia y Bienestar | 4 | Experiencia y Bienestar |
| 17 | Gerencia General | 2 | *(sin gerencia)* |
| 18 | Digitalización | 1 | *(sin gerencia)* |

## 5. Dashboards y visualización

**✅ Flujo de navegación en 3 niveles (especificación confirmada):**

1. **Nivel 1 — Gerencias (landing):** grid de las gerencias, ordenadas por volumen de tickets creados, para identificar de un vistazo cuáles son las que más impactan operativamente.
2. **Nivel 2 — Detalle de Gerencia:** al entrar a una gerencia, desagregado por sus áreas asociadas (según el mapeo Área→Gerencia pendiente de confirmar), mostrando cuál área específica es la que más pesa dentro de esa gerencia.
3. **Nivel 3 — Detalle de Área:** al seleccionar un área puntual, vista operativa de los tickets: qué está **pendiente**, cuáles **no tienen avances/actualizaciones recientes** (tickets estancados), y el **estado actual** de cada uno (abierto, en progreso, en espera, resuelto, etc.).

**Tipos de visualización requeridos (MVP):**
- Gráficos de tendencia (líneas) — evolución en el tiempo
- Comparativos entre áreas (barras)
- Indicadores tipo semáforo/gauge — para metas verde/amarillo/rojo
- Tablas detalladas con filtros
- **Creados vs. Resueltos** — vista clásica de throughput/backlog
- **Tickets con alto volumen de comentarios** — proxy de casos complejos/escalados que requieren atención de gerencia
- **Comparativo semana vs. semana** (ej. Semana 1 vs Semana 2 en cantidades) — variación semanal por área
- **Tickets estancados** (sin actualización en X días) — requiere definir el umbral de "sin avance" (¿3 días? ¿5 días hábiles?)
- **Ranking de impacto**: gerencias y áreas ordenadas por volumen de creación, para priorizar atención gerencial

- **✅ Filtros interactivos por fecha, área, persona:** confirmado, requerido.
- **✅ Exportar reportes (PDF/Excel):** implementado (28 ago 2026). Botones "Exportar Excel" / "Exportar PDF" en `/reportes` (respeta los filtros de la URL), `/areas/[slug]` y `/personas`. El Excel trae el detalle completo sin el límite de filas de la pantalla; el PDF es un reporte ejecutivo de una página con KPIs y gráficas de barras, pensado para compartir en reunión. Código en `src/lib/export/`.
- **✅ Alertas:** cuando un KPI se sale de rango, se resalta en **color rojo**.
- **✅ Vista consolidada "toda la empresa":** confirmado, sí.
- **Nueva dimensión de filtro:** "Tipo de Requerimiento" (`customfield_10010`) — se usa para saber el tipo de requerimiento más solicitado por sede/área.
- **Nueva vista:** desagregado también **por persona individual** (assignee), no solo por área/sede/gerencia — necesario para que el gerente/coordinador pueda auditar a su equipo.

**Pendiente técnico:** definir qué valores de "Estado" existen en Jira/JSM (workflow real) para poder mapear el tablero de estado del Nivel 3 a los estados reales, en vez de un genérico Abierto/En progreso/Resuelto.

**✅ Estados reales confirmados (dos vocabularios distintos según el proyecto):**

| Grupo de proyectos | Estados |
|---|---|
| Los 10 proyectos "estándar" (Analítica, Audiencias Web, BackOffice, Cobro Coactivo, DEI, FrontOffice, Gestión de la Atención, GIC, Multas, Qx Tránsito) | EN ESPERA DE SOPORTE, EN PROGRESO, SOLICITADO A QUIPUX, A LA ESPERA DE CLIENTE, RESUELTO, CANCELADO |
| Mesa de ayuda SITTI y Mesa de ayuda SMM | ABIERTO, A LA ESPERA DEL PROVEEDOR, A LA ESPERA DE USUARIO, EN PROGRESO, CANCELADO, RESUELTO |

⚠️ **Implicación de diseño:** como hay dos vocabularios distintos, el tablero de Nivel 3 no puede usar 4 columnas genéricas iguales para todos los proyectos. Propongo normalizar a una **categoría de estado** común para que el tablero se vea consistente entre proyectos, conservando el texto literal en el detalle de cada ticket:

| Categoría (columna del tablero) | Estados que incluye |
|---|---|
| Pendiente | ABIERTO, EN ESPERA DE SOPORTE |
| En progreso | EN PROGRESO |
| Esperando terceros | SOLICITADO A QUIPUX, A LA ESPERA DE CLIENTE, A LA ESPERA DEL PROVEEDOR, A LA ESPERA DE USUARIO |
| Resuelto | RESUELTO |
| Cancelado | CANCELADO |

**⚠️ Por validar contigo:** ¿esta agrupación en 5 categorías tiene sentido de negocio, o prefieres verlas separadas/agrupadas distinto?

## 6. Integración con Atlassian ✅ (decisión tomada)

**Arquitectura de dos capas:**

1. **Núcleo de dashboards (MVP):** API REST de Atlassian + JQL fijo por filtro (ya implementado/probado por el equipo). Es la fuente de los KPIs numéricos y gráficos en tiempo real.
2. **Copiloto SITTI (Fase 2):** Capa de IA opcional usando Claude + Rovo MCP Server (`https://mcp.atlassian.com/v1/mcp/authv2`, OAuth 2.1) para resúmenes en lenguaje natural y auditorías ad-hoc por parte de gerencia. No reemplaza la capa 1, la complementa.

**Modelo de datos en Jira (✅ actualizado con mapeo real de campos):**
- Origen: Jira Service Management (JSM), distribuido en **12 proyectos/portales independientes**.
- **10 proyectos** (Analítica, Audiencias Web, BackOffice, Cobro Coactivo, DEI, FrontOffice, Gestión de la Atención, GIC, Multas, Qx Tránsito) comparten exactamente el mismo formato de campos:

| Campo API Jira | Nombre interno | Tipo |
|---|---|---|
| `summary` | Título_Ticket | texto |
| `project` | Proyecto | texto |
| `created` | Fecha_Creación | fecha |
| `assignee` | Persona_Asignada | texto |
| `status` | Estado_Ticket | texto |
| `priority` | Prioridad | texto |
| `resolutiondate` | Fecha_Cierre | fecha |
| `issuetype` | Tipo_de_Incidencia | texto |
| `customfield_10010` | Tipo_de_Requerimiento | texto |
| `customfield_10066` | Sede | texto (checklist) |
| `customfield_10506` | Área | texto (checklist) |
| `customfield_10044` | Tiempo_de_Primera_Respuesta (TTFR) | numérico/duración |
| `customfield_10043` | Tiempo_de_Resolución (TTR) | numérico/duración |

- **Proyecto "Mesa de ayuda SITTI":** mismos campos que arriba, **sin** el campo `project` (proyecto único, no aplica distinguir).

- ⚠️ **Excepción importante — proyecto "Mesa de ayuda SMM":**
  - **NO** usa `customfield_10506` para Área. Usa un campo distinto: **`customfield_11698` = Dependencia_SMM**.
  - **✅ Manejo confirmado:** la consulta a la API trae **ambos** campos (`customfield_10506` y `customfield_11698`) en la tabla maestra. En el ETL/consultas, para tickets del proyecto "Mesa de ayuda SMM" se usa `customfield_11698` como Área; para el resto de los 11 proyectos se usa `customfield_10506`. Es una regla simple de "switch por proyecto" al momento de leer la columna correcta, no requiere lógica compleja.
  - **NO** tiene campo de Sede — la sede para todos los tickets de este proyecto es **siempre "Caribe"**, se fija por código (hardcode) en vez de leerlo de Jira.

- **✅ Valores reales del campo Sede (`customfield_10066`)** — corrige la lista anterior:
  - `Caribe`
  - `Centro de Servicios` — ⚠️ **con "S" mayúscula.** Confirmado por consulta directa a `jira_cache.tickets_raw` (27 ago 2026): el literal real es `Centro de Servicios`, no `Centro de servicios` como se había asumido antes de conectar a Jira real. `catalogo.ts` tenía la minúscula, y como el match de sede es por texto exacto, esos 652 tickets no encontraban su sede en el catálogo y el pin desaparecía del mapa por completo. Corregido en `catalogo.ts`.
  - `Sao Paulo`
  - `Poblado`
  - `Concesionarios` — sede nueva: **✅ confirmado**, agrupa varios puntos físicos (varios centros comerciales/locales de carros) bajo un solo valor genérico "Concesionarios" en Jira — no se distingue el punto físico exacto en el dato. Para el mapa interactivo, se representa como **un solo pin genérico** (no georreferenciado a una dirección única), ya que no hay forma de saber desde el dato de Jira a qué concesionario específico corresponde cada ticket.
  - `Premium Plaza - Belén`

  ⚠️ **Cambio respecto al prototipo ya construido:** el mapa interactivo (`sitti-gerencias-prototipo.html`) tiene pines con nombres distintos a estos 6 valores reales (ej. "Punto MásCerca Poblado" y "Punto MásCerca Belén" como sedes separadas, cuando en realidad es un solo valor combinado "Premium Plaza - Belén"; y "Tránsito Caribe" + "Servicios Caribe" cuando los valores reales son "Caribe" y "Centro de Servicios"). Hay que renombrar los 6 pines para que coincidan exactamente con los valores del campo.

- **Implicación técnica clave:** el dashboard de un área (ej. "Cartera") probablemente necesita agregar tickets **de varios de los 12 proyectos a la vez**, no de uno solo — y para "Mesa de ayuda SMM" específicamente, la consulta debe usar `cf[11698]` en vez de `cf[10506]`. El JQL para los 11 proyectos "estándar" es `project in (X, Y, Z, ...) AND cf[10506] = "Cartera"`; para SMM sería una consulta aparte con `cf[11698]`.
- ⚠️ **Riesgo de calidad de datos:** al ser selección manual, puede haber tickets mal categorizados. No bloquea el MVP, pero conviene monitorear consistencia.

**Pendiente por definir:**
- ✅ Confirmado: **Jira/JSM Cloud** (no Data Center) — compatible con Rovo MCP para la Fase 2 sin restricciones.
- ✅ **Confirmado vía API:** "Área" es un campo compartido en **11 de los 12 proyectos**, `customfield_10506` (excepción: SMM usa `customfield_11698`).
- ⚠️ **Por confirmar:** si los valores del campo `customfield_11698` (Dependencia_SMM) coinciden con las 17 áreas estándar o son un listado propio de SMM.
- ✅ Confirmado: **Solo lectura**. La integración se construye con permisos mínimos (API token/OAuth de solo lectura) — sin riesgo de modificar datos en el sistema origen.
- ✅ **Frecuencia de sincronización confirmada: 2 veces al día** (ver sección 4) — simplifica el diseño del ETL, no se necesita sync en tiempo real.
- Volumen esperado (proyectos/issues) para dimensionar rate-limits — dato ya aproximado por el total de casos 2026 (~9,000+ registros sumando las 17 áreas), a confirmar si se requiere paginación/caché agresivo.

**Sección 6 — Integración con Atlassian: ✅ Completa y lista para implementar.**

## 7. Plataforma y arquitectura técnica

- **Decisión: Web responsive** (no app nativa) — prioriza verse bien tanto en computador (trabajo diario) como en reuniones/presentaciones de toma de decisiones.
- Dispositivos prioritarios (¿se usará más en escritorio o en celular?)

### ✅ Arquitectura de despliegue (decisión confirmada)

**Patrón de datos: ETL "truncate & reload"**
- La app NO consulta Jira en vivo en cada carga de pantalla — sincroniza periódicamente (job programado) trayendo todo el histórico vía API/JQL, y lo carga en PostgreSQL local.
- **✅ Frecuencia confirmada: 2 veces al día** (cron programado, ej. 6am y 2pm) — no se necesita sync en tiempo real, dato confirmado en sección 4. Esto simplifica el job: no hace falta optimizar para baja latencia, solo para que las 2 corridas diarias sean confiables.
- ⚠️ **Detalle técnico importante:** el truncate+reload debe hacerse contra una tabla "staging" con swap atómico (o transacción única), para evitar una ventana de tiempo donde el dashboard muestre "0 tickets" mientras se recarga.
- Beneficio directo: la app sigue funcionando (con el último dato sincronizado) si Jira está lento o caído, y los filtros internos son instantáneos porque no dependen de la API en cada clic.

**Base de datos:** una sola instancia PostgreSQL, dos esquemas:
- `jira_cache` — tablas que se truncan/recargan en cada sync (tickets, con área/sede/gerencia/estado/fechas/comentarios).
- `auth` — tablas de login propias de SITTI (usuarios, sesiones), que **nunca se truncan**. Contraseñas con hash seguro (bcrypt/argon2).

**Despliegue: Docker + servidor Linux (VM), aprendizaje guiado:**
- 3 contenedores: **Nginx** (proxy inverso + SSL), **App SITTI** (frontend + backend), **PostgreSQL** (cache Jira + login).
- Nginx es el único punto de entrada público (HTTPS); la app y la base de datos no se exponen directamente a internet.
- Volumen persistente de Docker para PostgreSQL (no perder datos al reiniciar contenedores).
- SSL gratuito vía Let's Encrypt/Certbot (o Caddy, que lo automatiza).
- Política `restart: unless-stopped` para que los contenedores se recuperen solos si la VM se reinicia.

**Git y mantenimiento:**
- Repositorio en GitHub (plan gratuito).
- Rama `main` protegida — todo cambio pasa por Pull Request, sin push directo.
- Flujo: rama `feature/*` → probar localmente con el mismo `docker-compose` que corre en producción → PR → merge a `main`.
- Los cambios pueden originarse manualmente o vía Claude Code — ambos siguen el mismo flujo de rama + PR.
- Deploy a la VM: **manual por ahora** (SSH + `git pull` + `docker compose up -d --build`). Automatizar con GitHub Actions queda como mejora futura, una vez el flujo manual esté dominado.

**Pendiente por definir:** proveedor de la VM (DigitalOcean, Azure — dado que ya usan Azure AD —, u otro), dominio a usar, tamaño de VM inicial.

### ✅ Esquema de base de datos — tabla maestra (diseño confirmado)

**Esquema `jira_cache`** (se trunca y recarga en cada sync):
- **`tickets_raw`** — tabla maestra cruda, un registro por ticket de Jira, fiel al orden y campos confirmados:

| # | Columna | Campo API Jira | Tipo PostgreSQL |
|---|---|---|---|
| 1 | `titulo_ticket` | `summary` | `text` |
| 2 | `proyecto` | `project` | `text` |
| 3 | `fecha_creacion` | `created` | `timestamptz` |
| 4 | `persona_asignada` | `assignee` | `text` |
| 5 | `estado_ticket` | `status` | `text` |
| 6 | `prioridad` | `priority` | `text` |
| 7 | `fecha_cierre` | `resolutiondate` | `timestamptz` |
| 8 | `tipo_incidencia` | `issuetype` | `text` |
| 9 | `tipo_requerimiento` | `customfield_10010` | `text` |
| 10 | `sede` | `customfield_10066` | `text` |
| 11 | `dependencia_smm` | `customfield_11698` | `text` |
| 12 | `area` | `customfield_10506` | `text` |
| 13 | `ttfr` | `customfield_10044` | ⚠️ pendiente confirmar (ver nota abajo) |
| 14 | `ttr` | `customfield_10043` | ⚠️ pendiente confirmar (ver nota abajo) |

- **Nota sobre `area` (col. 12) vs. `dependencia_smm` (col. 11):** ambas se guardan siempre, en columnas separadas — el ETL no las combina. Las consultas/vistas eligen cuál usar según el `proyecto`: si `proyecto = 'Mesa de ayuda SMM'` → usar `dependencia_smm`; para el resto → usar `area`.
- ⚠️ **`ttfr`/`ttr` — tipo de dato en revisión:** el usuario los especificó como fecha, pero también indicó que el valor resultante puede ser positivo o negativo — lo que sugiere que el campo real de la API es un **objeto SLA de Jira** (con `remainingTime`, `breached`, etc.), no una fecha ni número simple. Se definirá con exactitud en cuanto se tenga un ejemplo real de la respuesta de la API — probablemente termine siendo una columna `jsonb` (para guardar el objeto completo) más 1-2 columnas calculadas (`ttr_minutos_restantes integer`, `ttr_incumplido boolean`) extraídas en el ETL.
- Fechas (`fecha_creacion`, `fecha_cierre`) vienen en ISO 8601 con zona horaria desde la API → mapean directo a `timestamptz`.
- A partir de esta tabla maestra, las métricas y reportes (por área, gerencia, sede, estado, persona, tipo de requerimiento, etc.) se calculan con **vistas o consultas SQL dinámicas**, filtradas según los botones/selecciones activas en la app — no se pre-calculan ni se guardan como columnas fijas.
- `sync_log` — bitácora de cada corrida del ETL: `iniciado_en`, `finalizado_en`, `estado` (éxito/error), `total_tickets`. Permite mostrar "última sincronización" en la UI y detectar si Jira lleva tiempo caído (relevante ahora que el sync es 2x/día, no continuo).

**Esquema `catalogo`** (configuración de negocio, NO se toca en el sync):
- `gerencias` — `id`, `nombre` (las 6 gerencias).
- `areas` — `id`, `nombre` (las 17 áreas), `gerencia_id` (FK) — aquí vive el mapeo Área→Gerencia pendiente de confirmar.
- `sedes` — `id`, `nombre`, `direccion` (las 6 sedes).

**Esquema `auth`** (login propio de SITTI, nunca se trunca):
- `usuarios` — `id`, `email`, `password_hash` (bcrypt/argon2), `rol` (gerente/coordinador/administrador), `activo`.
- `sesiones` — `id`, `usuario_id` (FK), `token`, `expira_en` (2 horas) — permite revocar accesos sin depender solo de la expiración del token.
- **Nuevo:** `usuario_area` / `usuario_sede` — tabla(s) de asignación muchos-a-muchos, necesarias para que un Coordinador solo vea sus áreas/sedes asignadas (ver corrección en sección 2).
- **Nuevo:** `audit_log` — quién hizo qué y cuándo (login, cambios de usuarios, exportaciones, etc.).
- **Nuevo:** `error_log` — fallos técnicos del sistema (fallas de sync, errores de API, etc.), para soporte/debug — tabla separada de `audit_log` porque tiene otro propósito y otro público (técnico vs. auditoría de negocio).

**Nota de diseño:** "días sin actualizar" (usado en el tablero de estado del Nivel 3) no se guarda como columna — se calcula al vuelo (`NOW() - actualizado_en`) en la consulta, para que siempre esté exacto sin recalcular nada en cada sync.
- Preferencia de stack (si tienes alguna) o carta libre para nosotros proponer
- Hosting: ¿tienen ya infraestructura (AWS, Azure, GCP, on-premise) o partimos de cero?
- ¿Debe integrarse con algún otro sistema interno además de Atlassian (ERP, CRM, Excel compartidos)?

## 8. Requisitos no funcionales

- **✅ Usuarios concurrentes:** ~15 aproximadamente (inicial).
- **✅ Disponibilidad:** no 24/7 estricto — horario **7am a 10pm** es suficiente (evita sobrecostos de infraestructura para las horas sin uso real).
- **✅ Idioma:** 100% español.
- Cumplimiento normativo si aplica (protección de datos, etc.) — *(pendiente, aplica probablemente Ley 1581 de 2012 de Colombia dado que se manejan datos de ciudadanos indirectamente vía Jira; a validar con el área jurídica de SITTI)*

## 9. Diseño / marca

**✅ Manual de Marca oficial recibido (29 ago 2026)** — reemplaza la paleta
inferida del prototipo de login que se usó como aproximación mientras no
existía el documento formal. Login, layout de referencia (radar animado +
ticker) y logo se mantienen: solo cambiaron los valores de color y las
tipografías, aplicados a toda la app incluido el login (excepción puntual,
ver CLAUDE.md §2.3 regla 11).
- Paleta: navy `#33357E` (Tecnología), navy profundo `#191B2B` (secundario
  oscuro), naranja `#EC623B` (Humanidad), dorado `#F7A82C` (Medellín),
  turquesa `#3FA9AC` (Movilidad), fondo `#F7F8FB`, magenta secundario
  `#961E65` (definido, sin aplicar todavía en ningún componente).
- Tipografía: Magdelin (títulos, oficial del manual — sin archivo de licencia
  disponible para web, se aproxima con **Fredoka**) + Lato (cuerpo/web,
  oficial) + Arial Nova (documentos de office, no aplica en el panel) + IBM
  Plex Mono (datos/etiquetas, se mantiene — el manual no cubre este rol).
- Layout de referencia: panel de marca (radar animado + ticker) / panel de
  contenido — sin cambios, solo colores.
- Logo oficial (horizontal) incrustado directamente desde el archivo real, no
  reconstruido. Favicon actualizado al logosímbolo/isotipo solo (antes era el
  logo horizontal completo).
- Autenticación: usuario/contraseña (ver sección 3).

**Logo de SITTI** — isotipo circular con las letras "T" e "i" estilizadas, más
wordmark "sitti" en minúsculas. Se recibieron **dos variantes**: vertical
(apilada, útil para login/splash) y horizontal (isotipo + wordmark en línea,
útil para navbar/header) — coincide exacto con el logosímbolo del manual
(pág. 22).

## 10. Roadmap propuesto

1. **Fase 0:** Cerrar este documento de requisitos
2. **Fase 1 (MVP):** Login + 1-2 áreas piloto + integración básica de lectura con Jira
3. **Fase 2:** Resto de áreas + dashboards avanzados + alertas
4. **Fase 3:** Escritura hacia Atlassian, app móvil nativa si aplica, exportables

---

### Próximo paso
Responde o comenta directamente sobre las secciones que ya tengas claras (aunque sea parcial), y dejamos "TBD" en las que falten. Con las secciones 1, 2, 4 y 6 resueltas ya podemos empezar a prototipar la pantalla de login y el primer dashboard piloto.
