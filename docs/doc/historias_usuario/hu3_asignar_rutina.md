# Historia de Usuario: Asignar una Rutina a un Socio

**ID:** HU3  
**Prioridad:** Alta  
**Estimación:** 2 Puntos  

---

## Descripción
**Como** un administrador del gimnasio  
**Quiero** crear y asignar una rutina de entrenamiento a un socio, especificando el día de la semana, un nombre y los ejercicios del catálogo con sus series y repeticiones  
**Para** que cada socio tenga un plan de entrenamiento personalizado y pueda seguirlo desde su cuenta  

---

## Criterios de Aceptación

### Escenario 1: Asignación exitosa de rutina
* **Dado que** he iniciado sesión como administrador y estoy en la sección de rutinas (`/admin/rutinas`)  
* **Cuando** selecciono un socio, elijo un día de la semana, agrego al menos un ejercicio del catálogo (con series y repeticiones) y presiono "Guardar"  
* **Entonces** el sistema debe guardar la rutina asociada al socio (`POST /api/rutinas/asignar`) y mostrar un mensaje de confirmación.  

### Escenario 2: Intentar guardar una rutina sin ejercicios
* **Dado que** estoy creando una rutina para un socio  
* **Cuando** intento guardarla sin haber agregado ningún ejercicio  
* **Entonces** el sistema debe impedir el guardado y mostrar una advertencia indicando que la rutina debe tener al menos un ejercicio.  

### Escenario 3: Explorar el catálogo de ejercicios
* **Dado que** estoy en el formulario de creación de rutina  
* **Cuando** filtro el catálogo por categoría (pecho, espalda, pierna, etc.)  
* **Entonces** el sistema debe mostrar solo los ejercicios de esa categoría, con su imagen, descripción y consejo, paginados para no cargar todo de una vez.  

### Escenario 4: Cancelar la creación de rutina
* **Dado que** estoy en el formulario de creación de rutina  
* **Cuando** hago clic en "Cancelar" o salgo de la vista  
* **Entonces** el sistema debe volver al listado sin guardar ningún dato.  

---

## Detalles de Diseño e Implementación
- **Acceso:** solo rol **admin** (guard en frontend + middleware `soloAdmin` en backend).
- **Campos de la rutina:**
  - Socio destino (`usuarioId`, requerido)
  - Nombre de la rutina (requerido)
  - Día de la semana (enum: Lunes a Domingo, requerido)
  - Ejercicios: arreglo con `nombre`, `series`, `repeticiones`, `instrucciones`, `imagenUrl` y `completado` (inicia en `false`)
- **Catálogo de ejercicios:** archivo estático `src/data/ejercicios-catalogo.ts` (`CATALOGO_EJERCICIOS`, `CATEGORIAS_UNICAS`); las imágenes/GIFs son assets locales en `public/ejercicios/`.
  - Los ejercicios se **copian** a la rutina (no se referencian), de modo que editar el catálogo no altera rutinas ya asignadas.
- **Multi-gimnasio:** la rutina guarda el `gymId` extraído del JWT; todas las consultas se filtran por gimnasio.
- **UX:** selección de ejercicios con arrastrar y soltar (drag & drop) y paginación de a 20 ejercicios por categoría.
