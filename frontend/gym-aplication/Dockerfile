# syntax=docker/dockerfile:1

# ---- Etapa 1: build de Angular ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# URL de la API. Angular la incrusta en el bundle al compilar, así que no se
# puede cambiar después arrancando el contenedor: hay que reconstruir la imagen.
# Vacío (por defecto) = se respeta environment.prod.ts, que apunta a Vercel.
# Para un servidor propio: --build-arg API_URL=https://api.tudominio.com
ARG API_URL=""
RUN if [ -n "$API_URL" ]; then \
      sed -i "s|apiUrl: *'[^']*'|apiUrl: '$API_URL'|" src/environments/environment.prod.ts && \
      echo "apiUrl fijado a $API_URL" && grep apiUrl src/environments/environment.prod.ts; \
    fi

# Dominio raíz para las páginas por gimnasio (<slug>.midominio.com). Igual que
# la API, Angular lo incrusta al compilar: sin pasarlo aquí, el contenedor no
# reconoce los subdominios y todos los gimnasios caen en el selector.
ARG TENANT_ROOT_DOMAIN=""
RUN if [ -n "$TENANT_ROOT_DOMAIN" ]; then \
      sed -i "s|tenantRootDomain: *'[^']*'|tenantRootDomain: '$TENANT_ROOT_DOMAIN'|" src/environments/environment.prod.ts && \
      echo "tenantRootDomain fijado a $TENANT_ROOT_DOMAIN" && grep tenantRootDomain src/environments/environment.prod.ts; \
    fi

# Salida en dist/frontend/browser. `npm run build` es hoy `ng build` a secas,
# igual que lo que corre Vercel, asi que lo que se ve en :8090 es lo mismo que
# se vera en produccion — que es justamente para lo que sirve este contenedor.
RUN npm run build

# ---- Etapa 2: servir estáticos con Nginx ----
FROM nginx:alpine
# Config de SPA (rewrite a index.html, cache, COOP para login de Google)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
