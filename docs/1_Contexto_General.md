# Proyecto Gym-app: Contexto General

## ¿Qué es Gym-app?
Gym-app es una plataforma integral Multi-tenant (Software as a Service - SaaS) diseñada para la gestión de uno o múltiples gimnasios y sus usuarios. Proporciona una interfaz moderna e intuitiva que permite a dueños de gimnasios y sus socios interactuar con los servicios, además de incluir un panel de Superadministrador para el control centralizado de todos los gimnasios afiliados. Los servicios principales incluyen el seguimiento de rutinas, planes de pago, noticias, registro de medidas corporales y progresos físicos.

## Arquitectura del Proyecto
La aplicación consta del patrón de arquitectura típica cliente-servidor (Stack MERN / Angular-Node) y se encuentra dividida claramente en dos repositorios/carpetas dentro del proyecto principal:

1. **Frontend (`/frontend/gym-aplication`)**
   -  Es una Single Page Application (SPA) desarrollada en **Angular 21**.

2. **Backend (`/backend`)**
   - Es una API RESTful construida con **Node.js** y **Express.js**, encargada de la lógica de negocio, reglas de seguridad y de conectar a la base de datos.
   - Las conexiones a la base de datos se hacen hacia **MongoDB** mediante el ODM Mongoose.

## Tecnologías Utilizadas

### Lado del Cliente (Frontend)
- **Framework:** Angular 21 (SPA, enrutamiento, RxJS para manejo reactivo).
- **Estilos y UI:** Tailwind CSS v4 para el desarrollo rápido y flexible de la interfaz de usuario.
- **Visualización de Datos:** Chart.js y `ng2-charts` para construir gráficos (por ejemplo, el historial de progresos físicos de los socios).
- **Service Workers:** `@angular/service-worker` habilitado para proveer funcionalidades de PWA (Aplicación Web Progresiva).

### Lado del Servidor (Backend)
- **Entorno:** Node.js.
- **Framework Web:** Express.js 5.x.
- **Base de Datos:** MongoDB.
- **ODM:** Mongoose v9.
- **Seguridad/Autenticación:** JSON Web Tokens (JWT) (`jsonwebtoken`) y cifrado de contraseñas con `bcryptjs`.
- **Utilidades:** 
  - `compression` para compresión gzip.
  - `cors` especializado y restringido. 
  - `node-cron` para posibles tareas automatizadas rutinarias.
  - `node-cache` para el almacenamiento en caché local.

## Entorno de Despliegue Configurado
El proyecto está optimizado y preparado para un entorno de nube moderno, específicamente orientado hacia **Vercel**:
- El **Frontend** está configurado en `vercel.json` para ser alojado como aplicación estática angular.
- El **Backend** está configurado a nivel global en su `vercel.json` que expone `index.js` como una Vercel Serverless Function (función sin servidor). La conexión a MongoDB de este backend está especialmente optimizada para manejar *cold-starts* característicos de entornos Serverless.
