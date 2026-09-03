-- ═══════════════════════════════════════════════════════════════════
-- SITTI — Panel de Gestión · esquema de base de datos
--
-- Diseñado para PostgreSQL 15+. Probado contra Neon (plan gratuito), que
-- es lo que se usa en el deploy de Vercel; funciona igual en un Postgres
-- en Docker si algún día se mueve a una VM propia.
--
-- Tres esquemas con ciclos de vida DISTINTOS — esa separación es el punto:
--
--   jira_cache  se TRUNCA y recarga en cada sync (2 veces al día)
--   catalogo    configuración de negocio; el sync NO la toca
--   auth        cuentas y bitácoras; NUNCA se trunca
--
-- Si esto viviera todo en un solo esquema, un `TRUNCATE` mal apuntado se
-- llevaría por delante los usuarios o el mapeo de áreas. Separado, el ETL
-- solo tiene permiso sobre lo que le corresponde.
--
-- Se aplica con:  npm run db:schema
-- ═══════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS jira_cache;
CREATE SCHEMA IF NOT EXISTS catalogo;
CREATE SCHEMA IF NOT EXISTS auth;


-- ═══════════════════════════════════════════════════════════════════
-- CATÁLOGO — configuración de negocio
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS catalogo.gerencias (
  slug   text PRIMARY KEY,
  nombre text NOT NULL,
  color  text NOT NULL DEFAULT '#33357E'
);

CREATE TABLE IF NOT EXISTS catalogo.areas (
  slug          text PRIMARY KEY,
  nombre        text NOT NULL,
  gerencia_slug text NOT NULL REFERENCES catalogo.gerencias(slug),
  -- Volumen de referencia 2026 confirmado por Alexis. Sirve para contrastar
  -- lo que trae el ETL contra lo esperado y detectar un sync incompleto.
  volumen_2026  integer
);

CREATE TABLE IF NOT EXISTS catalogo.sedes (
  slug       text PRIMARY KEY,
  -- OJO: debe coincidir LITERAL con el valor del campo `Sede`
  -- (customfield_10066) en Jira. Si no coincide, los tickets de esa sede
  -- quedan huérfanos y el mapa muestra un pin en cero.
  nombre     text NOT NULL UNIQUE,
  direccion  text,
  lat        double precision,
  lon        double precision,
  -- true = el pin agrupa varios puntos físicos (caso "Concesionarios")
  aproximado boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS catalogo.proyectos (
  clave        text PRIMARY KEY,
  nombre       text NOT NULL UNIQUE,
  -- 'estandar' | 'mesa' — los dos vocabularios de estado que existen en JSM
  vocabulario  text NOT NULL,
  -- Qué customfield leer para el Área en este proyecto.
  -- 'Mesa de ayuda SMM' es la excepción: usa customfield_11698.
  campo_area   text NOT NULL DEFAULT 'customfield_10506',
  -- Si el proyecto no tiene campo de Sede, se fija por código.
  sede_fija    text REFERENCES catalogo.sedes(nombre)
);


-- ═══════════════════════════════════════════════════════════════════
-- JIRA_CACHE — se trunca y recarga en cada sync
-- ═══════════════════════════════════════════════════════════════════

-- Tabla maestra: un registro por ticket, fiel a los campos confirmados.
CREATE TABLE IF NOT EXISTS jira_cache.tickets_raw (
  clave                text PRIMARY KEY,          -- ej. 'QXT-4821'
  titulo_ticket        text,                      -- summary
  proyecto             text,                      -- project
  fecha_creacion       timestamptz,               -- created
  persona_asignada     text,                      -- assignee
  persona_informadora  text,                      -- reporter (el cliente/ciudadano que crea el ticket)
  estado_ticket        text,                      -- status (literal de Jira)
  prioridad            text,                      -- priority
  fecha_cierre         timestamptz,               -- resolutiondate
  fecha_actualizacion  timestamptz,               -- updated
  tipo_incidencia      text,                      -- issuetype
  tipo_requerimiento   text,                      -- customfield_10010
  sede                 text,                      -- customfield_10066
  dependencia_smm      text,                      -- customfield_11698
  area                 text,                      -- customfield_10506
  comentarios          integer NOT NULL DEFAULT 0,

  -- TTFR / TTR.
  -- Se guarda el objeto crudo de la API en jsonb PORQUE todavía no está
  -- confirmado su formato exacto (ver CLAUDE.md §9.1). Guardar el original
  -- permite recalcular las columnas derivadas sin volver a pegarle a Jira
  -- el día que se entienda bien la forma del dato.
  ttfr_raw             jsonb,                     -- customfield_10044
  ttr_raw              jsonb,                     -- customfield_10043
  ttfr_horas           double precision,          -- derivada en el ETL
  ttr_horas            double precision,          -- derivada en el ETL
  ttfr_incumplido      boolean,
  ttr_incumplido       boolean
);

-- Índices sobre los ejes por los que SIEMPRE se filtra o agrupa.
-- Sin estos, cada carga del panel hace seq scan sobre ~9.000 filas: hoy no
-- se nota, pero con varios años de histórico sí.
CREATE INDEX IF NOT EXISTS ix_tickets_fecha    ON jira_cache.tickets_raw (fecha_creacion);
CREATE INDEX IF NOT EXISTS ix_tickets_sede     ON jira_cache.tickets_raw (sede);
CREATE INDEX IF NOT EXISTS ix_tickets_area     ON jira_cache.tickets_raw (area);
CREATE INDEX IF NOT EXISTS ix_tickets_smm      ON jira_cache.tickets_raw (dependencia_smm);
CREATE INDEX IF NOT EXISTS ix_tickets_asignado ON jira_cache.tickets_raw (persona_asignada);
CREATE INDEX IF NOT EXISTS ix_tickets_estado   ON jira_cache.tickets_raw (estado_ticket);
CREATE INDEX IF NOT EXISTS ix_tickets_proyecto ON jira_cache.tickets_raw (proyecto);

-- Tabla de staging: el ETL escribe TODO acá y solo al final la intercambia
-- con la tabla real, dentro de una transacción.
--
-- Por qué no truncar y recargar `tickets_raw` directo: entre el TRUNCATE y el
-- último INSERT hay una ventana de varios minutos en la que el panel mostraría
-- "0 tickets" y todo el mundo creería que se cayó el sistema.
CREATE TABLE IF NOT EXISTS jira_cache.tickets_staging
  (LIKE jira_cache.tickets_raw INCLUDING ALL);

-- `CREATE TABLE IF NOT EXISTS` no altera una tabla ya existente. En una base
-- que se aplicó antes de que `persona_informadora` existiera, estos ALTER son
-- lo que de verdad la agregan — en las dos tablas, porque el swap completo
-- (§ arriba) exige que `tickets_raw` y `tickets_staging` tengan las mismas
-- columnas. Seguro correrlos de nuevo (columna ya creada -> no-op).
ALTER TABLE jira_cache.tickets_raw     ADD COLUMN IF NOT EXISTS persona_informadora text;
ALTER TABLE jira_cache.tickets_staging ADD COLUMN IF NOT EXISTS persona_informadora text;

-- Bitácora del ETL. Alimenta el sello de "Sync dd/mm, HH:MM" del topbar y
-- permite darse cuenta de que Jira lleva rato caído — algo que con un sync
-- de 2 veces al día no es evidente a simple vista.
CREATE TABLE IF NOT EXISTS jira_cache.sync_log (
  id             bigserial PRIMARY KEY,
  iniciado_en    timestamptz NOT NULL DEFAULT now(),
  finalizado_en  timestamptz,
  estado         text NOT NULL DEFAULT 'en_curso',  -- en_curso | exito | error
  total_tickets  integer,
  detalle        text
);

CREATE INDEX IF NOT EXISTS ix_sync_log_fin ON jira_cache.sync_log (finalizado_en DESC);


-- ═══════════════════════════════════════════════════════════════════
-- AUTH — cuentas, permisos y bitácoras. Nunca se trunca.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS auth.usuarios (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,       -- usuario de ingreso (nombre.apellido)
  nombre         text NOT NULL,
  -- bcrypt o argon2. NUNCA texto plano, nunca MD5/SHA1.
  password_hash  text NOT NULL,
  rol            text NOT NULL CHECK (rol IN ('gerente', 'coordinador', 'administrador')),
  activo         boolean NOT NULL DEFAULT true,
  -- Acceso a la pestaña Personas: permiso explícito por usuario, no derivado
  -- del rol (ver `puedeVerPersonas` en src/lib/auth/tipos.ts). El administrador
  -- la ve siempre sin importar este valor.
  ver_personas   boolean NOT NULL DEFAULT false,
  creado_en      timestamptz NOT NULL DEFAULT now()
);

-- `CREATE TABLE IF NOT EXISTS` no altera una tabla ya existente: en una base
-- que se aplicó antes de que `ver_personas` existiera, el ALTER de abajo es
-- lo que de verdad la agrega. Sí es seguro correrlo de nuevo (columna ya
-- creada -> no-op).
ALTER TABLE auth.usuarios ADD COLUMN IF NOT EXISTS ver_personas boolean NOT NULL DEFAULT false;

-- Módulo "Administración de usuarios" + "Gestión de perfiles" (spec Alexis,
-- sep 2026). Campos nuevos de la ficha de usuario — sección 2.1/2.2 de la
-- spec. `rol` NO se toca todavía: sigue siendo lo que usan login/middleware
-- hasta que el sistema de perfiles (más abajo) lo reemplace por completo.
ALTER TABLE auth.usuarios ADD COLUMN IF NOT EXISTS apellidos text;
ALTER TABLE auth.usuarios ADD COLUMN IF NOT EXISTS tipo_documento text;   -- 'CC'|'CE'|'TI'|'PA'|'NIT'
ALTER TABLE auth.usuarios ADD COLUMN IF NOT EXISTS numero_documento text;
ALTER TABLE auth.usuarios ADD COLUMN IF NOT EXISTS sexo text;            -- 'M'|'F'|'Otro'
ALTER TABLE auth.usuarios ADD COLUMN IF NOT EXISTS celular text;         -- opcional, sin validación
ALTER TABLE auth.usuarios ADD COLUMN IF NOT EXISTS control_ip boolean NOT NULL DEFAULT false;
ALTER TABLE auth.usuarios ADD COLUMN IF NOT EXISTS tipo_usuario text NOT NULL DEFAULT 'interno_sitti'
  CHECK (tipo_usuario IN ('interno_sitti', 'externo_smm', 'externo_esu'));
ALTER TABLE auth.usuarios ADD COLUMN IF NOT EXISTS sede_slug text REFERENCES catalogo.sedes(slug);
-- true = la próxima vez que este usuario inicie sesión, antes de dejarlo
-- entrar hay que obligarlo a definir una contraseña nueva (flujo de
-- restablecimiento del administrador, ver `/cambio-password-obligatorio`).
ALTER TABLE auth.usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password boolean NOT NULL DEFAULT false;
ALTER TABLE auth.usuarios ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT now();

-- Búsqueda de la sección 1.1: "Nombre funcionario o Usuario acceso o Número
-- de documento" en un solo campo de texto.
CREATE INDEX IF NOT EXISTS ix_usuarios_busqueda
  ON auth.usuarios (lower(nombre), lower(coalesce(apellidos, '')), lower(email), numero_documento);

-- Permisos: cada fila es "este usuario ve esta área DENTRO de esta sede".
--
-- Es una tupla y no dos listas sueltas (usuario_area + usuario_sede) porque
-- el requisito confirmado es que la visibilidad de área va anidada dentro de
-- la sede: un coordinador puede ver Cartera solo en Caribe y Multas solo en
-- Poblado. Con dos listas independientes eso sería imposible de expresar —
-- daría acceso al producto cruzado.
--
-- '*' significa "todas".
CREATE TABLE IF NOT EXISTS auth.usuario_permiso (
  usuario_id  uuid NOT NULL REFERENCES auth.usuarios(id) ON DELETE CASCADE,
  sede_slug   text NOT NULL,   -- slug de catalogo.sedes, o '*'
  area_slug   text NOT NULL,   -- slug de catalogo.areas, o '*'
  PRIMARY KEY (usuario_id, sede_slug, area_slug)
);

-- ─────────────────────────────────────────────────────────────
-- PERFILES — roles con permisos granulares por pantalla/acción/gráfico
-- (módulo "Gestión de perfiles", spec Alexis sep 2026).
--
-- Eje ORTOGONAL a `usuario_permiso` de arriba: `usuario_permiso` decide qué
-- DATOS ve un usuario (sede/área); esto de acá decide qué PANTALLAS, BOTONES
-- y GRÁFICOS ve. No se fusionan a propósito — mezclarlos habría obligado a
-- que cada perfil cargara también con la combinatoria de sede/área, cuando
-- son dos preguntas distintas ("qué puede hacer" vs "sobre qué datos").
--
-- El catálogo de pantallas/acciones/widgets vive como fuente de verdad en
-- `src/lib/auth/modulos.ts` (mismo patrón que `catalogo.ts` para
-- gerencias/áreas/sedes) y se siembra acá vía `scripts/apply-schema.ts`.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth.pantallas (
  slug   text PRIMARY KEY,
  nombre text NOT NULL,
  orden  integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS auth.acciones (
  slug   text PRIMARY KEY,
  nombre text NOT NULL
);

-- Qué acciones son válidas dentro de cada pantalla (controla los checkboxes
-- que se ofrecen en el formulario de perfil, sección 3.3.3 de la spec). No
-- guarda permisos en sí — eso vive en `perfil_pantalla_accion`.
CREATE TABLE IF NOT EXISTS auth.pantalla_accion (
  pantalla_slug text NOT NULL REFERENCES auth.pantallas(slug) ON DELETE CASCADE,
  accion_slug   text NOT NULL REFERENCES auth.acciones(slug)  ON DELETE CASCADE,
  PRIMARY KEY (pantalla_slug, accion_slug)
);

CREATE TABLE IF NOT EXISTS auth.widgets (
  slug          text PRIMARY KEY,
  pantalla_slug text NOT NULL REFERENCES auth.pantallas(slug) ON DELETE CASCADE,
  nombre        text NOT NULL,
  orden         integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS auth.perfiles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL UNIQUE,
  descripcion    text,
  activo         boolean NOT NULL DEFAULT true,
  -- true SOLO para "Administrador": no se puede editar ni eliminar desde la
  -- UI (sección 3.5 de la spec: debe tener acceso total siempre).
  es_sistema     boolean NOT NULL DEFAULT false,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- Pantallas visibles para el perfil.
CREATE TABLE IF NOT EXISTS auth.perfil_pantalla (
  perfil_id     uuid NOT NULL REFERENCES auth.perfiles(id)    ON DELETE CASCADE,
  pantalla_slug text NOT NULL REFERENCES auth.pantallas(slug) ON DELETE CASCADE,
  PRIMARY KEY (perfil_id, pantalla_slug)
);

-- Acciones concretas habilitadas por pantalla, para el perfil.
CREATE TABLE IF NOT EXISTS auth.perfil_pantalla_accion (
  perfil_id     uuid NOT NULL REFERENCES auth.perfiles(id) ON DELETE CASCADE,
  pantalla_slug text NOT NULL,
  accion_slug   text NOT NULL,
  PRIMARY KEY (perfil_id, pantalla_slug, accion_slug),
  FOREIGN KEY (pantalla_slug, accion_slug)
    REFERENCES auth.pantalla_accion (pantalla_slug, accion_slug) ON DELETE CASCADE
);

-- Widgets/gráficos visibles para el perfil.
CREATE TABLE IF NOT EXISTS auth.perfil_widget (
  perfil_id   uuid NOT NULL REFERENCES auth.perfiles(id) ON DELETE CASCADE,
  widget_slug text NOT NULL REFERENCES auth.widgets(slug) ON DELETE CASCADE,
  PRIMARY KEY (perfil_id, widget_slug)
);

-- Relación muchos-a-muchos usuario↔perfil. "Cargo" (formulario de usuario) y
-- "Perfiles" (columna de la tabla de usuarios) son la MISMA asignación,
-- mostrada en dos lugares del UI — no hay perfil "principal" vs "secundario".
CREATE TABLE IF NOT EXISTS auth.usuario_perfil (
  usuario_id uuid NOT NULL REFERENCES auth.usuarios(id) ON DELETE CASCADE,
  perfil_id  uuid NOT NULL REFERENCES auth.perfiles(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, perfil_id)
);
CREATE INDEX IF NOT EXISTS ix_usuario_perfil_perfil ON auth.usuario_perfil (perfil_id);

-- Sesiones. El token va en cookie httpOnly, pero se registra acá para poder
-- REVOCAR un acceso sin esperar a que expire solo (requisito de la sección 3).
CREATE TABLE IF NOT EXISTS auth.sesiones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES auth.usuarios(id) ON DELETE CASCADE,
  -- Hash del token, no el token. Si alguien lee la tabla, no se lleva sesiones vivas.
  token_hash  text NOT NULL,
  creada_en   timestamptz NOT NULL DEFAULT now(),
  expira_en   timestamptz NOT NULL,           -- creada_en + 2 horas
  revocada    boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS ix_sesiones_usuario ON auth.sesiones (usuario_id);
CREATE INDEX IF NOT EXISTS ix_sesiones_expira  ON auth.sesiones (expira_en);

-- Bitácora de AUDITORÍA: quién hizo qué y cuándo.
-- Público: gerencia / cumplimiento.
CREATE TABLE IF NOT EXISTS auth.audit_log (
  id          bigserial PRIMARY KEY,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  actor       text NOT NULL,        -- email del usuario
  accion      text NOT NULL,        -- login_exitoso | login_fallido | logout | usuario_creado | ...
  detalle     text,
  ip          inet
);

CREATE INDEX IF NOT EXISTS ix_audit_fecha ON auth.audit_log (ocurrido_en DESC);
CREATE INDEX IF NOT EXISTS ix_audit_actor ON auth.audit_log (actor);

-- Bitácora de ERRORES técnicos: fallas de sync, errores de API, excepciones.
-- Público: soporte / quien mantiene la app.
--
-- Es una tabla separada de audit_log a propósito. Mezcladas, el ruido técnico
-- (que es mucho más frecuente) taparía el rastro de auditoría, que es
-- justamente lo que hay que poder leer limpio.
CREATE TABLE IF NOT EXISTS auth.error_log (
  id          bigserial PRIMARY KEY,
  ocurrido_en timestamptz NOT NULL DEFAULT now(),
  origen      text NOT NULL,        -- etl | api | ui | auth
  mensaje     text NOT NULL,
  detalle     jsonb
);

CREATE INDEX IF NOT EXISTS ix_error_fecha ON auth.error_log (ocurrido_en DESC);


-- ═══════════════════════════════════════════════════════════════════
-- VISTA — resuelve el switch de Área por proyecto
-- ═══════════════════════════════════════════════════════════════════
--
-- ⚠️ Esta vista existe para que NADIE tenga que recordar la excepción de SMM.
-- Consulta SIEMPRE `v_tickets`, nunca `tickets_raw` directo: si consultas la
-- tabla cruda y filtras por `area`, todos los tickets de "Mesa de ayuda SMM"
-- desaparecen en silencio — y ese proyecto es de los que más volumen mueve.

-- `DROP` + `CREATE` y no `CREATE OR REPLACE`: Postgres exige que un
-- `CREATE OR REPLACE VIEW` conserve el nombre de cada columna existente en su
-- misma posición ordinal. Como esta vista expande `t.*`, cada vez que
-- `tickets_raw` gana una columna nueva (vía `ALTER TABLE ADD COLUMN`, que
-- siempre la agrega al final de la tabla real) el `REPLACE` falla con
-- "cannot change name of view column" porque las columnas calculadas
-- (`area_efectiva` en adelante) se corren un lugar. `DROP` evita ese problema
-- de raíz — es seguro porque es una vista de solo lectura, no hay datos que
-- perder.
DROP VIEW IF EXISTS jira_cache.v_tickets;
CREATE VIEW jira_cache.v_tickets AS
SELECT
  t.*,
  CASE
    WHEN t.proyecto = 'Mesa de ayuda SMM' THEN t.dependencia_smm
    ELSE t.area
  END AS area_efectiva,
  -- Categoría normalizada de estado, para que el tablero se vea igual entre
  -- los dos vocabularios. El texto literal se conserva en `estado_ticket`.
  CASE
    WHEN t.estado_ticket IN ('ABIERTO', 'EN ESPERA DE SOPORTE')            THEN 'pendiente'
    WHEN t.estado_ticket = 'EN PROGRESO'                                    THEN 'en-progreso'
    WHEN t.estado_ticket IN ('SOLICITADO A QUIPUX', 'A LA ESPERA DE CLIENTE',
                             'A LA ESPERA DEL PROVEEDOR', 'A LA ESPERA DE USUARIO')
                                                                            THEN 'esperando-terceros'
    WHEN t.estado_ticket = 'RESUELTO'                                       THEN 'resuelto'
    WHEN t.estado_ticket = 'CANCELADO'                                      THEN 'cancelado'
    ELSE 'pendiente'
  END AS categoria_estado,
  -- "Días sin actualizar" se calcula al vuelo, no se guarda: así siempre está
  -- exacto sin depender de cuándo corrió el último sync.
  EXTRACT(DAY FROM (now() - t.fecha_actualizacion))::int AS dias_sin_actualizar
FROM jira_cache.tickets_raw t;
