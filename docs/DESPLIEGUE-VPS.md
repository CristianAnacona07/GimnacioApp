# Despliegue en un servidor propio (VPS)

Todo el sistema —base de datos, almacén de archivos, API y web— corre en
contenedores dentro de un único servidor. No depende de ningún servicio externo
de pago.

**Lo que hay que hacer una sola vez:** apuntar el dominio y arrancar. A partir de
ahí, cada gimnasio nuevo funciona en su subdominio sin tocar el servidor.

---

## 1. Qué hace falta

- Un VPS con Ubuntu 22.04 o superior. Con **2 GB de RAM alcanza**; con 1 GB, la
  compilación de Angular puede quedarse sin memoria (ver *Problemas* al final).
- Un dominio comprado.
- Acceso por SSH al servidor.

---

## 2. DNS: dos registros y listo

En el panel donde compraste el dominio, apuntando a la IP del servidor:

| Tipo | Nombre | Valor          | Para qué |
|------|--------|----------------|----------|
| A    | `@`    | IP del servidor | `midominio.com` |
| A    | `*`    | IP del servidor | `kodiak.midominio.com`, `sogafit.midominio.com`… |

El segundo es el importante: ese **comodín** hace que cualquier subdominio
llegue al servidor. Sin él habría que crear un registro por cada gimnasio.

> Los cambios de DNS pueden tardar desde minutos hasta unas horas en propagarse.
> Comprobalo con `ping kodiak.midominio.com` — debe responder la IP del servidor.

---

## 3. Preparar el servidor

```bash
ssh root@LA-IP-DEL-SERVIDOR

# Docker
curl -fsSL https://get.docker.com | sh

# Cortafuegos: solo web y SSH abiertos al mundo
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# El código
git clone https://github.com/CristianAnacona07/GimnacioApp.git
cd GimnacioApp
```

---

## 4. Configurar

```bash
cp .env.prod.example .env
nano .env
```

Rellená el dominio, el correo y **genera cada contraseña** con:

```bash
openssl rand -base64 32
```

No reutilices contraseñas entre `JWT_SECRET`, `POSTGRES_PASSWORD` y
`MINIO_PASSWORD`: son tres cosas distintas y una filtración no debe
comprometerlas todas.

---

## 5. Arrancar

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

La primera vez tarda varios minutos (compila Angular). Seguí el avance con:

```bash
docker compose -f docker-compose.prod.yml logs -f
```

Cuando entres a `https://midominio.com` el candado aparece solo: Caddy pide el
certificado en ese momento. **La primera visita a cada dominio tarda unos
segundos de más** por eso mismo; las siguientes son instantáneas.

---

## 6. Crear el primer superadministrador

```bash
docker compose -f docker-compose.prod.yml exec backend \
  env SUPERADMIN_EMAIL=tucorreo@ejemplo.com SUPERADMIN_PASSWORD='una-clave-larga' \
  node scripts/crear-superadmin.js
```

Entrá en `https://midominio.com/sa` y desde ahí creá los gimnasios. Cada uno
queda disponible en `https://<slug>.midominio.com` de inmediato.

---

## 7. Despliegue automático (opcional, recomendado)

Sin esto, cada cambio que llega a `main` en GitHub hay que aplicarlo a mano en
el servidor (`git pull` + reconstruir), como en los pasos de arriba. Con esto
puesto, el servidor se actualiza solo apenas hay algo nuevo.

Es un `cron` que revisa `origin/main` cada 2 minutos — no un webhook de
GitHub, que exigiría acceso de administrador al repositorio (Settings →
Webhooks) y no todos los que despliegan tienen ese permiso. El costo es hasta
2 minutos de demora en vez de instantáneo; a cambio, no depende de nadie más
que del propio servidor.

```bash
# /root/deploy.sh — resumen de lo que hace:
#   git fetch origin main
#   si el commit local ya coincide con origin/main, no hace nada
#   si no, git reset --hard origin/main + docker compose up -d --build
#   registra cada corrida en /root/deploy.log
```

Se instala una sola vez con un script — pedile a quien administre el servidor
que lo configure, o hacelo vos mismo creando `/root/deploy.sh` (arriba) y
`/etc/cron.d/gimnacio-deploy` con `*/2 * * * * root /root/deploy.sh`.

**No toca datos**: `.env` y la base de datos están fuera de git, así que un
`git reset --hard` nunca los pisa — solo reemplaza archivos de código.

**Flujo de trabajo con esto puesto:**
1. Trabajás en una rama propia (o en `development`), probás en local.
2. Cuando está listo, se fusiona a `main` y se sube (`git push`).
3. Dentro de los próximos 2 minutos, el servidor lo toma solo — sin que nadie
   tenga que entrar por SSH.

Ver el historial de despliegues: `cat /root/deploy.log` en el servidor.

---

## Cómo está armado

```
            internet
               │  443
         ┌─────▼─────┐
         │   Caddy   │  HTTPS automático (también para los subdominios)
         └─────┬─────┘
   ┌───────────┼────────────┬──────────────┐
   │           │            │              │
/api/*    /socket.io/*  /archivos/*      resto
   │           │            │              │
backend    backend        minio        frontend
   │
   ├── postgres (datos)
   └── minio    (fotos)
```

Solo Caddy asoma a internet. La base de datos, el almacén y la API únicamente
se ven desde dentro de la red de Docker: **no tienen puerto publicado**, así que
no se puede llegar a ellos desde fuera aunque se sepa la contraseña.

### Por qué Caddy y no nginx

La app crea un subdominio por gimnasio. Con nginx haría falta un certificado
comodín, que solo se emite validando por DNS y hay que renovar cada 90 días.
Caddy consigue el certificado **la primera vez que alguien visita el
subdominio** y lo renueva solo.

Para que eso no sea un agujero —cualquiera podría apuntar su dominio al
servidor y hacernos pedir certificados hasta que nos bloqueen por abuso— Caddy
le pregunta antes al backend si el dominio corresponde a un gimnasio existente
(`/api/gym/dominio-permitido`). Si no, no pide nada.

Caddy además reenvía los WebSockets sin configuración extra, que es lo que
mantiene vivo el tiempo real (recepción, avisos y rutinas).

---

## Operación diaria

```bash
# Actualizar a la última versión del código
git pull && docker compose -f docker-compose.prod.yml up -d --build

# Ver qué está pasando
docker compose -f docker-compose.prod.yml logs -f backend

# Respaldo de la base de datos
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -F c -f /tmp/respaldo.dump
docker compose -f docker-compose.prod.yml cp postgres:/tmp/respaldo.dump ./respaldo-$(date +%F).dump
# bajalo del servidor con scp
```

> Si cambiás `DOMINIO` en el `.env`, hay que **reconstruir** el frontend
> (`up -d --build frontend`): Angular incrusta la dirección al compilar, no la
> lee al arrancar.

### Conectarse a la base desde tu máquina

Postgres no tiene ningún puerto publicado (ni siquiera en el propio servidor),
así que la forma normal de entrar es un `psql` dentro del propio contenedor:

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

Para usar una GUI como DBeaver desde tu máquina hace falta publicar el puerto
solo en el loopback del servidor (agregá `ports: ["127.0.0.1:5432:5432"]` al
servicio `postgres` en `docker-compose.prod.yml`) y después sí abrir el túnel:

```bash
ssh -L 5432:localhost:5432 root@LA-IP -N
```

---

## Problemas frecuentes

**El certificado no se emite.** Comprobá que el DNS ya apunta al servidor
(`ping kodiak.midominio.com`) y que los puertos 80 y 443 están abiertos: la
validación necesita ambos. Mirá `docker compose -f docker-compose.prod.yml logs caddy`.

**Un gimnasio nuevo da error de certificado.** Su `slug` tiene que existir y
estar activo, porque es lo que responde `/api/gym/dominio-permitido`. Probalo:
`curl "https://midominio.com/api/gym/dominio-permitido?domain=kodiak.midominio.com"`
— debe responder `ok`.

**El tiempo real no funciona** (recepción no se actualiza sola). Suele ser un
proxy intermedio, no el servidor. La app sigue andando igual porque conserva
las consultas periódicas como respaldo; se nota en que tarda más.

**Se queda sin memoria al compilar.** Con 1 GB de RAM, Angular puede morir
durante el build. Agregá memoria de intercambio antes de arrancar:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

**Google no deja iniciar sesión.** Hay que añadir `https://midominio.com` como
origen autorizado en Google Cloud → Credenciales. Google no acepta comodines,
así que cada subdominio que use login de Google se agrega a mano; la alternativa
es dejar ese botón solo en el dominio principal.
