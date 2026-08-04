# Historia de Usuario: Inicio de Sesión (Login)

**ID:** HU1  
**Prioridad:** Alta  
**Estimación:** 3 Puntos  

---

## Descripción
**Como** un usuario registrado (admin o socio) de un gimnasio  
**Quiero** ingresar mis credenciales (correo electrónico y contraseña) o usar mi cuenta de Google en la plataforma  
**Para** acceder de manera segura a mi panel según mi rol (gestión del gimnasio o mi rutina y progreso)  

---

## Criterios de Aceptación

### Escenario 1: Selección de gimnasio previa al login
* **Dado que** ingreso a la plataforma sin un gimnasio seleccionado  
* **Cuando** navego a la ruta de selección de gimnasios (`/gimnasios`)  
* **Entonces** el sistema debe permitirme elegir mi gimnasio y guardarlo (`gymActual`) antes de mostrar el formulario de login.  

### Escenario 2: Inicio de sesión exitoso
* **Dado que** estoy en la página de inicio de sesión con un gimnasio seleccionado y tengo una cuenta activa  
* **Cuando** ingreso mi correo electrónico válido y mi contraseña correcta, y hago clic en "Iniciar Sesión"  
* **Entonces** el sistema debe autenticarme y redirigirme según mi rol: administrador al panel de administración (`/admin`) y socio a su dashboard (`/socio`).  

### Escenario 3: Intento con credenciales incorrectas
* **Dado que** estoy en la página de inicio de sesión  
* **Cuando** ingreso un correo o contraseña incorrectos y hago clic en "Iniciar Sesión"  
* **Entonces** el sistema debe mostrar un mensaje de error claro indicando que las credenciales son incorrectas y permanecer en la misma página (sin cerrar la sesión de otras pestañas ni borrar el gimnasio seleccionado).  

### Escenario 4: Validación de campos vacíos
* **Dado que** estoy en la página de inicio de sesión  
* **Cuando** intento hacer clic en "Iniciar Sesión" sin haber completado alguno de los campos obligatorios  
* **Entonces** el sistema debe mostrar una validación visual indicando qué campos son requeridos.  

### Escenario 5: Inicio de sesión con Google
* **Dado que** estoy en la página de inicio de sesión  
* **Cuando** hago clic en "Iniciar sesión con Google" y completo el flujo de Google OAuth  
* **Entonces** el sistema debe verificar el token de Google en el backend (`POST /api/auth/google`), crear o vincular mi cuenta y redirigirme según mi rol.  

---

## Detalles de Diseño e Implementación
- **Campos del formulario:**
  - Correo electrónico (input tipo `email`, requerido)
  - Contraseña (input tipo `password`, requerido)
- **Seguridad:**
  - Ocultar la contraseña al escribir.
  - El backend valida las credenciales con `bcrypt` y emite un **JWT con expiración de 8 horas** que incluye `id`, `role` y `gymId`.
  - El token se almacena en `localStorage` junto con `userId`, `usuario`, `role`, `nombre` y `gymActual`.
  - El interceptor HTTP adjunta `Authorization: Bearer <token>` a cada petición.
  - `TokenMonitorService` revisa el token cada 60 segundos: lo renueva automáticamente cuando quedan menos de 2 horas y advierte al usuario cuando quedan menos de 30 minutos.
  - Al expirar la sesión se limpia solo la información de autenticación, **preservando** cronómetro, tema y gimnasio seleccionado (`StorageService.clearSessionPreservingData()`).
- **Rutas y guards:**
  - `noAuthGuard` impide que un usuario ya autenticado vuelva al login.
  - `authGuard` protege las rutas privadas y aplica la separación por rol (`/admin/*` solo para admin).
- **App móvil (Android):** el login de Google usa el flujo híbrido nativo (Credential Manager con respaldo por navegador AppAuth), nunca el WebView embebido.
