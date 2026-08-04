# Historia de Usuario: Visualizar Mi Rutina Semanal

**ID:** HU4  
**Prioridad:** Alta  
**Estimación:** 3 Puntos  

---

## Descripción
**Como** un socio autenticado del gimnasio  
**Quiero** ver la rutina semanal que mi administrador/entrenador me asignó, organizada por día de la semana  
**Para** saber qué ejercicios me corresponden cada día, con sus series, repeticiones e instrucciones  

---

## Criterios de Aceptación

### Escenario 1: Visualización sin rutina asignada
* **Dado que** he iniciado sesión como socio y aún no tengo rutinas asignadas  
* **Cuando** ingreso a "Mi Rutina" (`/socio/mi-rutina`)  
* **Entonces** el sistema debe mostrar un mensaje amigable indicando que todavía no tengo una rutina asignada.  

### Escenario 2: Ver la rutina del día actual
* **Dado que** tengo rutinas asignadas para varios días de la semana  
* **Cuando** ingreso a "Mi Rutina"  
* **Entonces** el sistema debe mostrar mis rutinas organizadas por día y hacer scroll automático al día actual, listando cada ejercicio con su nombre, series, repeticiones e imagen.  

### Escenario 3: Ver el detalle de un ejercicio
* **Dado que** estoy viendo mi rutina del día  
* **Cuando** hago clic sobre un ejercicio  
* **Entonces** el sistema debe mostrar su vista de detalle con la demostración (imagen/GIF), instrucciones y consejos de ejecución.  

### Escenario 4: Aislamiento de datos
* **Dado que** soy un socio autenticado  
* **Cuando** consulto mis rutinas  
* **Entonces** el sistema debe devolver únicamente las rutinas asociadas a **mi** usuario y **mi** gimnasio (identificados desde el JWT, nunca desde parámetros manipulables por el cliente).  

---

## Detalles de Diseño e Implementación
- **Ruta frontend:** `/socio/mi-rutina` (componente `mi-rutina`, protegido por `authGuard`).
- **API:** `GET /api/rutinas/:usuarioId` con middleware `verificarToken`; el backend usa el `userId` y `gymId` del token para garantizar el aislamiento.
- **UI Componentes:**
  - Agrupación por día de la semana (Lunes a Domingo) con auto-scroll al día actual.
  - Tarjeta de ejercicio: imagen, nombre, series × repeticiones, indicador de completado.
  - Vista `ejercicio-detalle` para la demostración completa del ejercicio.
- **Extras integrados en la vista:**
  - **Cronómetro de descanso** flotante con presets (30s, 60s, 90s, 2min), persistente en localStorage + IndexedDB; en la app Android dispara una alarma nativa aunque la app esté cerrada.
  - **Registro de progreso** (peso/repeticiones por ejercicio) con guardado automático del formulario para no perder datos al recargar o expirar el token.
