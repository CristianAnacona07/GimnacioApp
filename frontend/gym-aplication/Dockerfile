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

# `ng build` pelado, NO `npm run build`.
#
# La diferencia entre los dos es scripts/flatten-layers.mjs, y ese paso rompe
# los estilos: aplana las capas de Tailwind v4 inflando la especificidad, con
# lo que su preflight queda en button:not(#\#):not(#\#) — (0,2,1) — y le gana
# por un elemento a cualquier estilo de componente Angular, que es
# .btn-login[_ngcontent-x] — (0,2,0). Resultado: todos los botones e inputs
# con estilo propio pierden su fondo y su borde redondeado.
#
# Vercel autodetecta Angular y corre `ng build`; android:sync tambien. Este
# contenedor era el unico del proyecto que llamaba a `npm run build`, asi que
# era el unico que se veia distinto. Con esto, lo que se ve en :8090 es lo
# mismo que se vera en produccion, que es justamente para lo que sirve.
#
# Salida en dist/frontend/browser
RUN npx ng build

# ---- Etapa 2: servir estáticos con Nginx ----
FROM nginx:alpine
# Config de SPA (rewrite a index.html, cache, COOP para login de Google)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
