# Estructura del Frontend (Angular App)

El Frontend está desarrollado sobre la versión **21 de Angular** y constituye la interfaz de usuario con la que los socios y administradores interactúan.

## Estructura de Proyecto

```bash
frontend/gym-aplication/
├── public/                 # Recursos e imágenes estáticas
└── src/                    # Código fuente
    └── app/                # Carpeta central de lógica Angular
        ├── /components     # Componentes visuales organizados en carpetas
        ├── /guards         # Protección de Rutas (Angular Router Guards)
        ├── /interceptors   # Interceptores HTTP (ej. adjuntar Tokens a peticiones)
        ├── /services       # Servicios inyectables (conexión a la API y manejo de estado)
        ├── app.routes.ts   # Archivo maestro de definición del arbol de navegación
        ├── app.config.ts   # Configuración de core
        └── app.component.* # Componente enraizador principal
```

## Sistema de Componentes (`/components`)
La experiencia de usuario está modularizada en varias carpetas que encierran dominios e intereses:

- **`/auth:`** Todo el sistema de entrada de usuarios (Login, Register).
- **`/superadmin:`** Panel exclusivo centralizado para Superadministradores (`/plataforma`), gestionar gimnasios, suscripciones y configuración multi-tenant.
- **`/admin:`** Paneles reservados para administración (creación/edición de datos sensibles de un gimnasio específico, incluyendo ajustes y logos).
- **`/socio:`** Vistas exclusivas de la cuenta del usuario, su dashboard, tableros y registro completo de progresos y medidas corporales (`/medidas`).
- **`/pagos` y `/planes:`**  Vistas e interfaces para la gestión de las inscripciones.
- **`/noticias:`** Renderización estática/dinámica de la sección de anuncios.
- **`/home:`** La ventana de aterrizaje de la aplicación, el Landing Page.
- **`/shared:`** Utilidades, barras de navegación (Navbars) dinámicas por gimnasio, Footers y componentes de uso común (ej. modales, botones compartidos).
- **`/ejercicio-detalle:`** Pantallas diseñadas para mostrar información exhaustiva al abrir/dar clic sobre un ejercicio en particular de una rutina.
- **`/gym-selector` y `/gym-registro`:** Interfaces interactivas para que el usuario encuentre o registre su gimnasio en la plataforma.

## Servicios (`/services`)
Actúan como la capa de abstracción para la lógica de datos y peticiones HTTP (mediante `HttpClient` u otros mecanismos, aunque figura dependencia `axios` instalada en `package.json`):

- **Interconexión con la API:** Existen servicios mapeados homólogamente a los endpoints de la base de datos, como: `auth.service`, `noticia.service`, `pagos.service`, `planes.service`, `modulos.service` y `progreso.service`.
- **Manejo de Estado (State Management) y Multi-tenant:** 
  - `user-state.service`: Utilizando BehaviorSubjects para persistir el inicio de sesión y datos vitales en memoria de la UI.
  - `gym.service`: Servicio reactivo para propagar el gimnasio actual seleccionado y reaccionar a sus cambios o módulos activos.
  - `theme.service`: Servicio encargado de inyectar variables CSS de forma dinámica en todo el frontend para cambiar la paleta de colores de acuerdo a las configuraciones de diseño de cada gimnasio.
- **Utilidades del Cliente:** 
  - `toast.service`: Componente para desplegar alertas cortas de éxito/error.
  - `confirm.service`: Componente para advertencias previas de eliminación u otra acción destructiva.

## Estilos y UX (TailwindCSS)
Se utiliza TailwindCSS en su versión más moderna (v4), lo que significa que el diseño a través de las plantillas `.html` se lleva a cabo estructurando clases funcionales. Esto facilita temas globales e independencia visual al máximo en cada componente.

## Visualización de Progreso (Charts)
Al apoyarse en la integración de `Chart.js` y `ng2-charts`, el código se encuentra equipado para desplegar líneas y gráficas sobre la evolución o las tendencias analíticas de los usuarios en relación a su seguimiento corporal y registro físico (consumidas a través de rutas hacia el Backend).
