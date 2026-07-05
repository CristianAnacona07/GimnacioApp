# syntax=docker/dockerfile:1

# ---- Etapa 1: dependencias de producción ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Instala SOLO dependencias de producción (sin nodemon/vitest/etc.)
RUN npm ci --omit=dev

# ---- Etapa 2: imagen final ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 10000

# Comprueba la salud usando el endpoint /health de la propia app
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||10000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Ejecuta como usuario sin privilegios (viene en la imagen node)
USER node

# server.js siempre escucha el puerto (a diferencia de index.js en modo Vercel)
CMD ["node", "server.js"]
