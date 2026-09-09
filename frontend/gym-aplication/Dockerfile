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

# La web se sirve a sí misma las imágenes: van en la misma máquina que la
# página, así que la ruta relativa siempre acierta — en local, en producción o
# en el subdominio de cualquier gimnasio. La dirección absoluta de
# environment.prod.ts es solo para el APK, que compila aparte y necesita saber
# a qué servidor ir a buscarlas.
RUN sed -i "s|mediaUrl: *'[^']*'|mediaUrl: ''|" src/environments/environment.prod.ts &&     grep mediaUrl src/environments/environment.prod.ts

# Salida en dist/frontend/browser. `npm run build` es hoy `ng build` a secas,
# igual que lo que corre Vercel, asi que lo que se ve en :8090 es lo mismo que
# se vera en produccion — que es justamente para lo que sirve este contenedor.
RUN npm run build

# ---- Paquete para la app instalada ----
#
# El APK ya no carga la web en vivo: la trae adentro. Para que igual se
# actualice sin reinstalar, cada despliegue publica la web como un zip más un
# updates.json que dice cuál es la última versión. La app lo consulta al
# arrancar, lo baja y lo aplica.
#
# La versión son los minutos transcurridos desde 1970: sube sola en cada
# compilación y es semver válido, que es lo que el plugin compara. Sin eso
# habría que acordarse de subir un número a mano en cada despliegue, y el día
# que alguien se olvide la app deja de actualizarse sin que nadie lo note.
# zip y no tar: es lo que el plugin sabe descomprimir, con index.html en la raíz.
RUN apk add --no-cache zip && \
    mkdir -p /app/ota && \
    (cd dist/frontend/browser && zip -qr /app/ota/bundle.zip . -x 'ejercicios/*') && \
    cd /app && \
    VERSION="1.0.$(( $(date +%s) / 60 ))" && \
    CHECKSUM=$(sha256sum ota/bundle.zip | cut -d' ' -f1) && \
    printf '{\n  "version": "%s",\n  "url": "https://snakegym.cloud/app/bundle.zip",\n  "checksum": "%s"\n}\n' \
      "$VERSION" "$CHECKSUM" > ota/updates.json && \
    printf 'location = /app/updates.json {\n    default_type application/json;\n    add_header Cache-Control "no-cache" always;\n    return 200 \x27%s\x27;\n}\n' \
      "$(tr -d '\n' < ota/updates.json)" > ota-updates.conf && \
    echo "paquete listo: version $VERSION" && cat ota/updates.json && cat ota-updates.conf

# ---- Etapa 2: servir estáticos con Nginx ----
FROM nginx:alpine
# Config de SPA (rewrite a index.html, cache, COOP para login de Google)
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
# El paquete de actualización, servido en /app/ del mismo dominio.
COPY --from=build /app/ota /usr/share/nginx/html/app
# Y el bloque que contesta ese manifiesto por POST, que es como lo pide el APK:
# nginx devuelve 405 a un POST sobre un archivo estático, así que la respuesta
# se arma acá con "return", que sirve para cualquier método.
COPY --from=build /app/ota-updates.conf /etc/nginx/ota-updates.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
