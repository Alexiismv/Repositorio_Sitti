# AGENTS.md

Este repositorio usa **[`CLAUDE.md`](CLAUDE.md)** como guía única para agentes de IA
(Claude Code, Cursor, Copilot, Zed, Windsurf, Codex…).

👉 **Lee [`CLAUDE.md`](CLAUDE.md) completo antes de tocar código.**

No se duplica el contenido acá a propósito: dos copias de las mismas reglas se
desincronizan a la primera semana, y entonces cada herramienta trabaja con una
versión distinta de la verdad.

## Lo mínimo, por si vas de afán

- **Qué es:** panel de indicadores de gestión sobre Jira Service Management, para
  SITTI / Secretaría de Movilidad de Medellín.
- **Correrlo:** `npm install && npm run dev` → http://localhost:3100
  (usuario `maria.gomez`, contraseña `demo1234`).
- **Estado:** demo funcional completo con datos generados. Falta conectar Neon +
  Jira y desplegar. El camino está en `CLAUDE.md` §4 → §7, en ese orden.
- **Verificar antes de decir "listo":** `npm run build` y `npm run lint` en verde,
  y si tocaste UI, ábrela en el navegador.

## Las tres reglas que más caro salen si se rompen

1. **"Mesa de ayuda SMM" usa `customfield_11698` para el Área**, no
   `customfield_10506`, y su sede es siempre `Caribe`. Saltarse ese switch hace
   desaparecer en silencio uno de los proyectos de mayor volumen.
2. **La integración con Jira es de SOLO LECTURA.** Nunca escribas al sistema origen.
3. **Nunca commitees `.env`, tokens ni `AUTH_SECRET`.**

El detalle de estas y las demás está en `CLAUDE.md` §2.
