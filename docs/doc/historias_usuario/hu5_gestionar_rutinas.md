# Historia de Usuario: Gestionar Rutinas (Completar, Modificar y Eliminar)

**ID:** HU5  
**Prioridad:** Alta  
**Estimación:** 3 Puntos  

---

## Descripción
**Como** socio, **quiero** marcar los ejercicios de mi rutina como completados; y **como** administrador, **quiero** poder editar o eliminar las rutinas asignadas  
**Para** llevar el seguimiento diario del entrenamiento y mantener las rutinas de los socios actualizadas  

---

## Criterios de Aceptación

### Escenario 1: Marcar un ejercicio como completado (socio)
* **Dado que** veo un ejercicio en mi rutina del día  
* **Cuando** hago clic en la casilla de verificación del ejercicio  
* **Entonces** el sistema debe alternar su estado de completado, persistirlo en la base de datos (`PATCH /api/rutinas/:rutinaId/ejercicio/:idx`) y actualizar la vista de forma inmediata.  

### Escenario 2: Reinicio diario del progreso
* **Dado que** completé ejercicios de mi rutina ayer  
* **Cuando** ingreso a mi rutina en un nuevo día  
* **Entonces** los ejercicios deben aparecer sin completar para la nueva sesión de entrenamiento (control de reset diario).  

### Escenario 3: Modificar una rutina (admin)
* **Dado que** soy administrador y veo la rutina de un socio (`/admin/detalle-rutina/:id`)  
* **Cuando** cambio el nombre, el día o los ejercicios y presiono "Guardar Cambios"  
* **Entonces** el sistema debe actualizar la rutina (`PUT /api/rutinas/actualizar/:id`) y reflejar los cambios para el socio.  

### Escenario 4: Eliminar una rutina con confirmación (admin)
* **Dado que** soy administrador y quiero borrar la rutina de un socio  
* **Cuando** hago clic en "Eliminar" y confirmo en el cuadro de diálogo  
* **Entonces** la rutina debe eliminarse de la base de datos (`DELETE /api/rutinas/eliminar/:id`) y desaparecer de la vista del socio.  

---

## Detalles de Diseño e Implementación
- **Permisos:**
  - Socio: solo puede alternar el estado `completado` de los ejercicios de **su propia** rutina.
  - Admin: crea, edita y elimina rutinas de los socios de **su** gimnasio (middleware `soloAdmin` + filtro por `gymId`).
- **Flujos:**
  - **Edición:** reutiliza el formulario/constructor de rutinas del admin con los datos precargados.
  - **Eliminación:** cuadro de diálogo de confirmación (`confirm.service`) para evitar borrados accidentales.
  - **Completado:** actualización optimista en la UI con persistencia inmediata en el backend.
- **Persistencia del seguimiento:** el estado de completado vive en el documento `Rutina` (campo `completado` por ejercicio); el control de reset diario se apoya en la clave `ultimoResetRutina`, que se preserva al cerrar sesión.
