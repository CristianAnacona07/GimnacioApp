# syntax=docker/dockerfile:1

# ---- Etapa 1: dependencias + cliente de Prisma ----
# `npm ci` completo (no --omit=dev): el CLI de `prisma` es una devDependency y
# hace falta tanto para `prisma generate` (código derivado del schema, que vive
# en node_modules/.prisma/client — node_modules/@prisma/client es solo un
# wrapper que lo re-exporta) como para `prisma migrate deploy` al arrancar el
# contenedor (ver CMD más abajo). Para una app de este tamaño no vale la pena
# la complejidad de una segunda etapa "solo producción" para ahorrar unos MB.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

# ---- Etapa 2: imagen final ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000

COPY --from=build /app/node_modules ./node_modules
COPY . .

EXPOSE 10000

# Comprueba la salud usando el endpoint /health de la propia app
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||10000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Ejecuta como usuario sin privilegios (viene en la imagen node)
USER node

# Aplica las migraciones pendientes antes de arrancar. server.js siempre
# escucha el puerto (a diferencia de index.js en modo Vercel).
CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]
