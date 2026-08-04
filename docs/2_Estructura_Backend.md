# Estructura del Backend (API REST)

El Backend es una API Node.js/Express, diseñada con una arquitectura de controladores/rutas enfocada en modelo de datos.

## Estructura de Directorios Principal

```bash
backend/
├── index.js             # Punto de entrada principal y configuración (Express app y conexión BD)
├── mongoose/            # (No explícito en root pero referenciado)
├── /middleware          # Lógica para interceptar peticiones (ej. verificación JWT)
├── /models              # Esquemas de datos Mongoose
├── /routes              # Definición de rutas Express de la API
├── .env / .env.local    # Variables de entorno
└── package.json         # Dependencias
```

## Modelos de Base de Datos (`/models`)
Todos los modelos de la base de datos de MongoDB están estructurados usando esquemas y modelos por medio de Mongoose. Gracias a la arquitectura Multi-tenant, la vasta mayoría de esquemas incluyen un identificador `gymId` para aislar la información correspondiente a cada gimnasio.

1. **Gym (Gimnasio):**
   - Corazón del sistema multi-tenant. Almacena la configuración de cada gimnasio, nombre, slug único, logotipo, colores personalizados (para el tema de la UI) y módulos activos.

1. **User (Usuario):**
   - Maneja la información del miembro (nombre, email, password, perfil, plan de suscripción actual, etc.).
2. **Rutina:**
   - Define el programa de ejercicios asignado o seguido por los usuarios, incluyendo días de la semana y series.
3. **Progreso:**
   - Registra el avance físico del usuario en el tiempo (fechas y peso). Utilizado intensamente para generar gráficos en front.
4. **Medidas:**
   - Almacena el historial detallado de las medidas corporales específicas de los usuarios (brazo, pecho, cintura, pierna, pantorrilla, etc.), apoyando el análisis de evolución física.
5. **Planes:**
   - La oferta comercial de suscripción del gimnasio (Mensualidades, Clases individuales, Anualidades, beneficios).
6. **Pagos:**
   - Todo la estructura financiera para llevar un control estricto de las transacciones (montos, fechas, comprobantes) que realizan los usuarios para mantener activa su afiliación.
7. **Noticias:**
   - Un gestor de contenido o anuncios/información relevante que visualizan los clientes del gimnasio.

## Rutas / Endpoints (`/routes`)
Todas las rutas de la API en el archivo principal `index.js` exponen los módulos con el prefijo `/api`:

- **Superadmin / Gyms:** `/api/gym` (Búsqueda, creación, configuración y eliminación de gimnasios por el superadministrador).
- **Autenticación (Auth):** `/api/auth` (Registro, Login, recuperación, y validación de tokens. Maneja logins de Superadmins).
- **Rutinas:** `/api/rutinas`  (CRUD de rutinas).
- **Noticias:** `/api/noticias` (Panel de novedades).
- **Planes:** `/api/planes`  (Modelos comerciales del gimnasio).
- **Pagos:** `/api/pagos` (Gestión de comprobación de deudas y saldos).
- **Progreso y Medidas:** `/api/progreso` y `/api/medidas` (Entrada y visualización del historial de evolución y medidas corporales).

## Optimizaciones y Consideraciones
- **Base de Datos Serverless Configurada:** Archivo `index.js` gestiona una variable `cachedDb` y opciones de conexión a mongoose específicas (`maxPoolSize`, `socketTimeoutMS`, `serverSelectionTimeoutMS`) para prevenir la agotación de conexiones en redes de arquitecturas FaaS como Vercel.
- **Middleware de Autorización:** Uso de middlewares como `soloSuperAdmin` y `soloAdmin` para restringir accesos según roles y gimnasio (`gymId`) correspondiente, protegiendo las rutas a nivel de inquilino.
- **Seguridad CORS:** Cuenta con validación estricta y dinámica para permitir `http://localhost:*` en desarrollo local y orígenes restringidos a `gimnacio-app.vercel.app` para entornos en producción.
- **Carga de Datos (Payloads):** Uso ampliado de límites (hasta `10mb`) en archivos JSON mediante express, sugiriendo que se admiten subidas limitadas por codificación en base64 de imágenes u otros documentos directamente.
