# syntax=docker/dockerfile:1

# ---- Etapa 1: build de Angular ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# npm run build = ng build (producción) + flatten-layers.mjs
# Salida en dist/frontend/browser
RUN npm run build

# ---- Etapa 2: servir estáticos con Nginx ----
FROM nginx:alpine
# Config de SPA (rewrite a index.html, cache, COOP para login de Google)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
