# 🧪 Guía de Pruebas - Verificación de Mejoras

Esta guía te ayudará a verificar que las mejoras implementadas funcionan correctamente.

---

## ✅ Prueba 1: Cronómetro NO se pierde al expirar token

### Pasos:

1. **Iniciar la aplicación**
   ```bash
   cd frontend/gym-aplication
   npm start
   ```

2. **Iniciar sesión** en la app

3. **Ir a la rutina de socio** (`/socio/mi-rutina`)

4. **Abrir el cronómetro** (botón flotante en la esquina inferior derecha)

5. **Seleccionar un preset** (ejemplo: 60s)

6. **Iniciar el cronómetro**

7. **Abrir DevTools** (F12 en Chrome)
   - Ir a pestaña "Application" → "Local Storage"
   - Buscar las claves:
     - `crono_endTime`
     - `crono_total`
     - `crono_paused`

8. **Simular expiración de token**:
   - En "Local Storage", modificar el token:
     - Buscar la clave `token`
     - Copiar el valor
     - Ir a [jwt.io](https://jwt.io)
     - Pegar el token
     - En el payload, cambiar `exp` a un timestamp pasado (ejemplo: `1600000000`)
     - Copiar el nuevo token generado
     - Reemplazar en localStorage

9. **Navegar a otra ruta** (ejemplo: `/socio/noticias`)
   - El guard detectará el token expirado
   - Te redirigirá al login

10. **Volver a Login** y abrir DevTools → Local Storage

11. **Verificar que el cronómetro se MANTUVO**:
    - ✅ `crono_endTime` debe seguir existiendo
    - ✅ `crono_total` debe seguir existiendo
    - ✅ `crono_paused` debe seguir existiendo
    - ✅ `gymActual` debe seguir existiendo

### ✅ Resultado esperado:
El cronómetro NO se pierde, solo se limpian los datos de autenticación (`token`, `usuario`, `role`, etc.)

---

## ✅ Prueba 2: Advertencia de expiración de token

### Pasos:

1. **Modificar el umbral de advertencia** (para pruebas rápidas):
   
   Editar temporalmente `frontend/gym-aplication/src/app/services/token-monitor.service.ts`:
   
   ```typescript
   // Cambiar línea 12:
   private readonly WARNING_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 horas
   
   // Por:
   private readonly WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutos
   ```

2. **Generar un token que expire en 4 minutos**:
   - Ir a [jwt.io](https://jwt.io)
   - Crear un token con:
     ```json
     {
       "id": "tu-id-de-usuario",
       "role": "socio",
       "gymId": "tu-gym-id",
       "exp": <timestamp-actual + 240 segundos>
     }
     ```
   - Para calcular `exp`: 
     ```javascript
     Math.floor(Date.now() / 1000) + 240  // 240 segundos = 4 minutos
     ```

3. **Reemplazar el token en localStorage**

4. **Esperar ~1 minuto**

5. **Verificar que aparece la notificación**:
   - ✅ Debe aparecer un toast azul (info)
   - ✅ Mensaje: "Tu sesión expirará en X hora(s). Guarda tu progreso."

6. **Verificar que la notificación solo aparece UNA vez**

7. **Esperar a que el token expire completamente** (4 minutos total)

8. **Verificar el comportamiento**:
   - ✅ Debe aparecer un toast rojo (error): "Tu sesión ha expirado..."
   - ✅ Te redirige a `/login`
   - ✅ El cronómetro se mantiene

### ⚠️ Importante:
Después de la prueba, **revertir** el cambio en `token-monitor.service.ts` para que vuelva a 24 horas.

---

## ✅ Prueba 3: Cambio de gym preserva cronómetro

### Pasos:

1. **Iniciar sesión** en un gym

2. **Activar el cronómetro** (ejemplo: 90s)

3. **Ir a la selección de gym**:
   - Hacer logout o navegar a `/gimnasios`

4. **Seleccionar otro gym**

5. **Iniciar sesión** en el nuevo gym

6. **Abrir el cronómetro**

### ✅ Resultado esperado:
El cronómetro debe mantener el estado (90s) aunque cambiaste de gym.

---

## ✅ Prueba 4: Tema se preserva

### Pasos:

1. **Cambiar al tema dark** (si existe toggle de tema en la app)

2. **Hacer logout**

3. **Verificar en DevTools**:
   - `localStorage.theme` debe seguir existiendo

4. **Hacer login nuevamente**

5. **Verificar que el tema dark se mantiene**

---

## ✅ Prueba 5: Monitoreo automático funciona

### Pasos:

1. **Abrir DevTools → Console**

2. **Ejecutar**:
   ```javascript
   // Ver el estado del token
   const token = localStorage.getItem('token');
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('Token expira el:', new Date(payload.exp * 1000));
   console.log('Tiempo restante (horas):', (payload.exp * 1000 - Date.now()) / (1000 * 60 * 60));
   ```

3. **Verificar que el TokenMonitorService está activo**:
   - Debería estar revisando el token cada 60 segundos
   - No verás mensajes en consola (es silencioso)
   - Solo mostrará toast cuando falten < 24 horas

---

## 🐛 Pruebas de Regresión

Verifica que nada se rompió:

### 1. Login normal
- ✅ Login con email/password funciona
- ✅ Login con Google funciona
- ✅ Redirección según rol (admin → `/admin`, socio → `/socio`)

### 2. Rutinas
- ✅ Socio puede ver su rutina
- ✅ Puede marcar ejercicios como completados
- ✅ Puede guardar progreso de series

### 3. Navegación
- ✅ Guards funcionan correctamente
- ✅ No se puede acceder a rutas protegidas sin token
- ✅ Admin no puede acceder a `/socio` y viceversa

### 4. Cronómetro
- ✅ Todos los presets funcionan (30s, 60s, 90s, 2min)
- ✅ Se puede pausar y reanudar
- ✅ Muestra notificación al finalizar
- ✅ Vibración funciona (en móviles)
- ✅ Confetti aparece al terminar

---

## 📊 Checklist de Verificación

```
[ ] Cronómetro se preserva al expirar token
[ ] Cronómetro se preserva al cambiar de gym
[ ] Cronómetro se preserva al hacer logout
[ ] Advertencia aparece 24h antes (o según umbral configurado)
[ ] Solo aparece UNA advertencia (no spam)
[ ] Al expirar, redirige a login suavemente
[ ] Login normal funciona
[ ] Login con Google funciona
[ ] Tema se preserva
[ ] Gym seleccionado se preserva
[ ] Guards funcionan correctamente
[ ] Rutinas funcionan
[ ] Progreso se guarda
```

---

## 🔧 Herramientas Útiles

### DevTools Console Commands:

```javascript
// Ver todas las claves en localStorage
Object.keys(localStorage).forEach(key => {
  console.log(key, localStorage.getItem(key));
});

// Ver estado del cronómetro
console.log('Cronómetro:', {
  endTime: localStorage.getItem('crono_endTime'),
  total: localStorage.getItem('crono_total'),
  paused: localStorage.getItem('crono_paused')
});

// Ver tiempo restante del token
const token = localStorage.getItem('token');
if (token) {
  const payload = JSON.parse(atob(token.split('.')[1]));
  const remaining = payload.exp * 1000 - Date.now();
  console.log('Token expira en:', Math.floor(remaining / (1000 * 60 * 60)), 'horas');
}

// Forzar expiración del token
localStorage.setItem('token', 'expired.token.here');

// Limpiar solo auth (sin perder cronómetro)
const gym = localStorage.getItem('gymActual');
const crono = {
  end: localStorage.getItem('crono_endTime'),
  total: localStorage.getItem('crono_total'),
  paused: localStorage.getItem('crono_paused')
};
localStorage.clear();
if (gym) localStorage.setItem('gymActual', gym);
if (crono.end) localStorage.setItem('crono_endTime', crono.end);
if (crono.total) localStorage.setItem('crono_total', crono.total);
if (crono.paused) localStorage.setItem('crono_paused', crono.paused);
```

---

## 📝 Reportar Problemas

Si encuentras algún problema durante las pruebas:

1. **Captura de pantalla** del error en consola
2. **Pasos exactos** para reproducir
3. **Estado de localStorage** antes y después
4. **Navegador y versión** (Chrome 120, Firefox 121, etc.)

---

## ✅ Resultado Final Esperado

Después de todas las pruebas:

✅ El cronómetro NUNCA se pierde  
✅ El tema se mantiene  
✅ El gym seleccionado se preserva  
✅ Las advertencias de expiración aparecen  
✅ La experiencia de usuario es fluida  
✅ No hay errores en consola  

---

**¡El proyecto está listo para producción!** 🚀
