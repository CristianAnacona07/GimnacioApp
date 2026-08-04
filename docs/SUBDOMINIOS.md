# Subdominios por gimnasio (multi-tenant por URL)

Cada gimnasio puede tener su propia URL usando su `slug` como subdominio:

```
https://sogafi.gimnasios.co   →  gym con slug "sogafi"
https://kodiak.gimnasios.co   →  gym con slug "kodiak"
```

El código **ya está listo**. Mientras no se configure un dominio, la app funciona
exactamente igual que siempre (selector de gimnasios en `/gimnasios`).

---

## Cómo funciona

1. Al arrancar, un `APP_INITIALIZER` ([app.config.ts](../frontend/gym-aplication/src/app/app.config.ts))
   detecta el subdominio con [TenantService](../frontend/gym-aplication/src/app/services/tenant.service.ts)
   y, si corresponde a un tenant, carga el gym por slug (`GET /api/gym/:slug`),
   lo guarda como `gymActual` y aplica sus colores/tema — todo antes de que el router navegue.
2. El guard [tenant.guard.ts](../frontend/gym-aplication/src/app/guards/tenant.guard.ts)
   redirige `/gimnasios` → `/login`: en un subdominio el gym ya está fijado por la URL.
3. La seguridad de datos no cambia: el aislamiento sigue siendo por el `gymId`
   firmado dentro del JWT en el backend. El subdominio es solo resolución de tenant + branding.
4. Bonus: cada subdominio es un origen distinto para el navegador, así que el
   `localStorage` (sesión, token) queda **separado por gimnasio** automáticamente.

Dominios donde NO aplica (flujo normal con selector): `*.vercel.app`, `localhost`,
la app Capacitor (`https://localhost`), `www.` y el dominio raíz sin subdominio.

---

## Pasos para activarlo (cuando se compre el dominio)

Supongamos que el dominio comprado es `gimnasios.co`.

### 1. Vercel (proyecto del frontend)

- Project → Settings → Domains → agregar:
  - `gimnasios.co`
  - `*.gimnasios.co` (wildcard)
- ⚠️ Para el **wildcard** Vercel exige que el dominio use los **nameservers de Vercel**
  (`ns1.vercel-dns.com`, `ns2.vercel-dns.com`). Se cambian donde se compró el dominio.
  Alternativa sin wildcard: agregar cada subdominio a mano (`sogafi.gimnasios.co`, …)
  con un CNAME a `cname.vercel-dns.com` — funciona, pero es manual por cada gym nuevo.

### 2. Frontend

- En [environment.prod.ts](../frontend/gym-aplication/src/environments/environment.prod.ts)
  poner el dominio real:
  ```ts
  tenantRootDomain: 'gimnasios.co'
  ```
- Redeploy del frontend.

### 3. Backend (Vercel → Environment Variables)

- Agregar `TENANT_ROOT_DOMAIN=gimnasios.co` y redeploy.
- Esto hace que CORS acepte `https://gimnasios.co` y `https://<slug>.gimnasios.co`.

### 4. Google OAuth (login con Google)

⚠️ Google **no acepta wildcards** en los orígenes autorizados. En
Google Cloud Console → Credenciales → cliente OAuth Web, hay que agregar en
"Orígenes de JavaScript autorizados" **cada subdominio** que use login de Google:

```
https://gimnasios.co
https://sogafi.gimnasios.co
https://kodiak.gimnasios.co
...
```

Es un paso manual por cada gimnasio nuevo (o se deja el login de Google solo en
el dominio principal y los subdominios usan email/contraseña).

### 5. Emails de recuperación de contraseña

`FRONTEND_URL` (backend) se usa para armar el link de reset. Con subdominios
conviene apuntarlo al dominio principal (`https://gimnasios.co`) — el link de
reset funciona igual porque el token no depende del subdominio.

---

## Probar en local (sin comprar nada)

Los navegadores modernos resuelven `*.localhost` a `127.0.0.1` sin tocar `/etc/hosts`:

1. Crear en la BD un gym con slug `sogafi` (o usar uno existente).
2. Levantar backend (`localhost:3000`) y frontend (`ng serve`).
3. Abrir `http://sogafi.localhost:4200` → debe cargar directo el login del gym
   "sogafi" con sus colores, sin pasar por el selector.
4. Abrir `http://localhost:4200` → flujo normal con selector.

(El `tenantRootDomain` de dev ya es `'localhost'` y el CORS del backend ya
acepta `http://<slug>.localhost:<puerto>`.)

---

## Checklist al dar de alta un gimnasio nuevo

1. Superadmin crea el gym con su `slug` (minúsculas, números y guiones).
2. Si NO hay wildcard: agregar `slug.gimnasios.co` como dominio en Vercel.
3. Si el gym usará login de Google: agregar el origen en Google Cloud Console.
4. Compartir la URL `https://<slug>.gimnasios.co` con el dueño del gimnasio.
