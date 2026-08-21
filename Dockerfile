# Imagen de producción para desplegar en una VM propia.
#
# El camino recomendado hoy es Vercel (ver CLAUDE.md §7). Este Dockerfile
# existe porque el levantamiento contempla una VM con Docker + Nginx como
# opción, y es mejor tenerlo listo que improvisarlo el día que se decida.
#
# Build multi-etapa: la imagen final no lleva ni el código fuente ni las
# dependencias de desarrollo.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# El build necesita salida a internet: next/font descarga las tipografías
# para servirlas self-hosted.
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100

# Usuario sin privilegios: si alguien logra ejecutar algo dentro del
# contenedor, no lo hace como root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3100
CMD ["node", "server.js"]
