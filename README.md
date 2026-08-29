# Gym App — Kodiak Gym

Aplicación de gestión de gimnasios con control de acceso por rol (superadmin,
admin, entrenador, socio): membresías, rutinas de entrenamiento, noticias,
métodos de pago y seguimiento del progreso de cada socio.

Este repositorio es un **monorepo**: el frontend y el backend se versionan
juntos, de modo que un cambio que toca la API y su consumo cabe en un solo
commit.

| Carpeta                  | Qué contiene                                                        |
| ------------------------ | ------------------------------------------------------------------- |
| `backend/`               | API REST en Node.js + Express 5, MongoDB con Mongoose, auth por JWT  |
| `frontend/gym-aplication/` | App Angular 21 (standalone components), Tailwind v4, PWA y Capacitor |
| `docs/`                  | Contexto del proyecto, historias de usuario y guías de despliegue    |

## Puesta en marcha

Cada proyecto tiene sus propias dependencias; instálalas por separado.

```bash
# Backend — necesita un .env (copia backend/.env.example como plantilla)
cd backend
npm install
npm start                 # nodemon, escucha en el puerto 10000

# Frontend — en otra terminal
cd frontend/gym-aplication
npm install
npm start                 # ng serve en http://localhost:4200
```

## Comandos frecuentes

```bash
cd backend && npm test                  # suite Vitest de la API
cd frontend/gym-aplication && npm test   # tests unitarios de Angular
cd frontend/gym-aplication && npm run build

# Android (Capacitor); requiere un build web previo
cd frontend/gym-aplication && npm run android:sync
```

## Integración continua

Los workflows viven en `.github/workflows/` y se disparan solo cuando cambia el
área que les corresponde:

- `backend-docker.yml` / `frontend-docker.yml` — publican las imágenes en GHCR
  (`ghcr.io/<owner>/<repo>/backend` y `.../frontend`).
- `android-build.yml` — compila el APK de debug y lo deja como artifact.
- `ios-build.yml` — compila iOS sin firma en un runner macOS.

## Documentación

Empieza por [CLAUDE.md](CLAUDE.md), que describe la arquitectura completa:
roles, aislamiento por gimnasio (`gymId`), flujo de autenticación y modelos de
datos. En [docs/arquitectura/](docs/arquitectura/) está cómo está construido el
sistema y por qué, con diagramas. En [docs/](docs/) están las historias de usuario, la guía de
[subdominios por gimnasio](docs/SUBDOMINIOS.md) y las notas de
[despliegue y móvil](docs/DESPLIEGUE-Y-MOVIL.md).
