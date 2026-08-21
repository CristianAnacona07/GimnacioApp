# Postgres de produccion para Vercel (Neon)

Guia para dejar el backend de Vercel corriendo sobre Postgres despues de la
migracion desde MongoDB. Si en cambio vas a autohospedar todo, mira
[DESPLIEGUE-VPS.md](DESPLIEGUE-VPS.md) — esta guia es solo para Vercel.

> **Por que Neon y no Supabase**: los dos tienen plan gratis, pero Vercel corre
> el backend como funciones serverless, donde cada peticion puede abrir su
> propia conexion. Neon esta hecho para eso (trae un endpoint con pool incluido)
> y tiene integracion nativa con Vercel que carga la variable sola. Supabase
> tambien sirve, pero suma autenticacion y almacenamiento que este proyecto no
> usa (ya tiene JWT propio y MinIO/S3 para archivos).

---

## 1. Crear la base en Neon

1. Entra a <https://neon.tech> y crea la cuenta (el plan **Free** alcanza:
   0.5 GB de datos, suficiente para arrancar).
2. Crea un proyecto. Elige la region **mas cercana a la region de tu proyecto de
   Vercel** (por defecto Vercel usa `iad1`, Washington D.C. → elegi `US East`).
   Si la base queda lejos del backend, cada consulta paga ese viaje de ida y vuelta.
3. Al terminar te muestra la cadena de conexion. **Copia la que dice "Pooled
   connection"**, no la directa: es la que aguanta muchas conexiones simultaneas.
   Se ve asi:

   ```
   postgresql://usuario:password@ep-algo-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

   El `-pooler` en el host es la senal de que es la correcta.

---

## 2. Aplicar las migraciones a la base nueva

La base nace vacia: hay que crearle las tablas. Esto se corre **una sola vez**,
desde tu maquina, apuntando a Neon:

```bash
cd backend
DATABASE_URL="<la cadena pooled de Neon>" npx prisma migrate deploy
```

Debe aplicar las 6 migraciones (`20260815000000_init` en adelante) sin errores.

> `migrate deploy` solo aplica las migraciones que ya existen en el repo, no
> inventa ninguna — es el comando correcto para produccion. `migrate dev` es
> para desarrollo y **no** se usa aca.

---

## 3. Cargar las variables en Vercel

En el proyecto **`gimnacio-app-backend`** de Vercel → *Settings* →
*Environment Variables*, con alcance **Production**:

| Variable                   | Valor                                              |
| -------------------------- | -------------------------------------------------- |
| `DATABASE_URL`             | La cadena *pooled* de Neon                          |
| `JWT_SECRET`               | Una clave larga y aleatoria (ver nota abajo)        |
| `FRONTEND_URL`             | `https://gimnacio-app.vercel.app`                   |
| `NODE_ENV`                 | `production`                                        |
| `EMAIL_USER` / `EMAIL_PASS`| Cuenta Gmail + contrasena de aplicacion             |
| `SMTP_HOST`                | **Vacia** (si tiene valor, ignora Gmail)            |

`JWT_SECRET` **tiene que ser el mismo de antes** si queres que las sesiones ya
abiertas sigan valiendo; si lo cambias, todo el mundo tiene que volver a entrar
(no es grave, pero conviene saberlo).

Opcionales, solo si ya las usabas: `GOOGLE_CLIENT_ID`,
`GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `TENANT_ROOT_DOMAIN`,
`WHATSAPP_*` y las `S3_*` (sin estas ultimas, la subida de fotos de la landing
responde 503 en vez de romper).

---

## 4. Llevar los datos que ya existen en Mongo

**Saltea este paso si la base de Mongo no tiene datos que te importen** — en ese
caso pasa directo al paso 5 y crea el superadmin a mano.

Si si hay socios/pagos reales cargados, el ETL los copia. Corre en seco por
defecto: cuenta lo que va a mover y no toca nada hasta que confirmes.

```bash
cd backend

# 1) Ensayo: no escribe nada, solo informa
MONGO_URI="<cadena de tu Mongo actual>" \
DATABASE_URL="<la cadena pooled de Neon>" \
node scripts/etl-mongo-to-postgres.js

# 2) De verdad, cuando los numeros del ensayo cuadren
CONFIRMAR_MIGRACION=si \
MONGO_URI="<cadena de tu Mongo actual>" \
DATABASE_URL="<la cadena pooled de Neon>" \
node scripts/etl-mongo-to-postgres.js
```

> **No borres la base de Mongo** hasta haber verificado varios dias que todo
> anda en Postgres. Es tu unica vuelta atras.

---

## 5. Crear el superadmin

Si la base arranca vacia (sin ETL), no hay con quien entrar. Se crea asi:

```bash
cd backend
DATABASE_URL="<la cadena pooled de Neon>" \
SUPERADMIN_EMAIL="tucorreo@dominio.com" \
SUPERADMIN_PASSWORD="una-clave-larga" \
node scripts/crear-superadmin.js
```

---

## 6. Redesplegar y comprobar

En Vercel → *Deployments* → *Redeploy* en el proyecto del backend (hace falta
para que tome las variables nuevas; cambiarlas no redespliega solo).

Despues, comproba de verdad, no de vista:

```bash
# Tiene que responder {"status":"ok"} y HTTP 200
curl -i https://gimnacio-app-backend.vercel.app/health
```

Si sigue dando **500 / FUNCTION_INVOCATION_FAILED**, mira los logs en Vercel →
*Deployments* → el ultimo → *Runtime Logs*. Los dos motivos habituales:

- `DATABASE_URL no está definido` → la variable no quedo en el alcance
  *Production*, o no redesplegaste despues de cargarla.
- Errores de conexion o timeouts → estas usando la cadena **directa** en vez de
  la *pooled*; volve al paso 1.

---

## Que hacer si urge volver atras

El commit anterior a la migracion es `645b8ae` (backend con Mongoose). Para
devolver produccion a ese estado sin perder nada del trabajo nuevo — que sigue
completo en la rama `feature/control-acceso-huella`:

```bash
git checkout main
git revert --no-commit 645b8ae..HEAD
git commit -m "revert: volver a Mongoose mientras se prepara el Postgres"
git push origin main
```
