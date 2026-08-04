# Historia de Usuario: Registro de Nuevo Usuario

**ID:** HU2  
**Prioridad:** Alta  
**Estimación:** 3 Puntos  

---

## Descripción
**Como** un visitante que asiste a un gimnasio afiliado a la plataforma  
**Quiero** crear una cuenta nueva proporcionando mi nombre, correo electrónico y una contraseña, asociada al gimnasio que seleccioné  
**Para** poder acceder como socio a mi rutina, noticias, planes y seguimiento de progreso  

---

## Criterios de Aceptación

### Escenario 1: Registro exitoso
* **Dado que** estoy en la página de registro con un gimnasio seleccionado  
* **Cuando** completo todos los campos obligatorios con datos válidos y hago clic en "Registrarse"  
* **Entonces** el sistema debe crear mi cuenta con rol **socio** vinculada al `gymId` del gimnasio seleccionado, mostrar un mensaje de éxito y llevarme al inicio de sesión.  

### Escenario 2: Correo electrónico ya registrado
* **Dado que** estoy en la página de registro  
* **Cuando** intento registrarme con un correo electrónico que ya existe en el sistema  
* **Entonces** el sistema debe mostrar un mensaje de error indicando que el correo ya está en uso y sugerir iniciar sesión.  

### Escenario 3: Contraseña demasiado corta
* **Dado que** estoy en la página de registro  
* **Cuando** ingreso una contraseña de menos de 6 caracteres  
* **Entonces** el sistema debe rechazar el registro y mostrar un mensaje indicando el mínimo de caracteres requerido.  

### Escenario 4: Campos obligatorios incompletos
* **Dado que** estoy en la página de registro  
* **Cuando** intento registrarme sin completar nombre, correo o contraseña  
* **Entonces** el sistema debe impedir el envío y señalar visualmente los campos faltantes.  

---

## Detalles de Diseño e Implementación
- **Campos del formulario:**
  - Nombre completo (input tipo `text`, requerido)
  - Correo electrónico (input tipo `email`, requerido, único en el sistema)
  - Contraseña (input tipo `password`, requerido, mínimo 6 caracteres)
- **Backend (`POST /api/auth/register`):**
  - Valida que `nombre`, `email` y `password` estén presentes y que la contraseña tenga al menos 6 caracteres.
  - Hashea la contraseña con `bcrypt` antes de guardarla.
  - Asocia el usuario al `gymId` recibido (aislamiento multi-gimnasio).
  - Registra `fechaRegistro`; la `fechaVencimiento` de la membresía la gestiona posteriormente el administrador.
- **Alternativa:** el usuario también puede registrarse automáticamente iniciando sesión con Google (se crea la cuenta al verificar el token).
- **Guard:** `noAuthGuard` evita que un usuario ya autenticado acceda al registro.
