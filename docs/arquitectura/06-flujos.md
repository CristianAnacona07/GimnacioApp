# Los flujos importantes

Cinco recorridos que explican cómo trabaja el sistema en la práctica.

## 1. Dar de alta un socio

No existe registro público: siempre empieza en el gimnasio.

```mermaid
sequenceDiagram
    participant R as Recepción
    participant A as API
    participant S as Socio nuevo

    R->>A: crear invitación
    A->>A: genera un código aleatorio (48 h de validez)
    A-->>R: enlace y código QR
    R->>S: se lo pasa por WhatsApp o se lo muestra
    S->>A: abre el enlace
    A-->>S: datos del gimnasio para mostrar su marca
    S->>A: envía sus datos y contraseña
    A->>A: consume la invitación en una sola operación
    alt ya estaba usada o venció
        A-->>S: enlace no válido
    else se consumió bien
        A->>A: crea la cuenta en el gimnasio de la invitación
        A-->>S: cuenta lista
    end
```

**El cliente nunca dice a qué gimnasio entra**: lo decide la invitación. Así es
imposible colarse en otro o quedar sin ninguno.

La invitación se consume con **una única operación condicional**, no leyendo y
después escribiendo. Dos personas abriendo el mismo enlace a la vez no pueden
registrarse las dos. Y si algo falla después de consumirla, se libera: un error
pasajero no quema el enlace.

## 2. Registrar una entrada al gimnasio

```mermaid
flowchart TD
    A["El socio llega"] --> B{"¿Cómo se identifica?"}
    B -->|"código de 6 dígitos"| C["Recepción lo escribe"]
    B -->|"código QR"| D["Recepción lo escanea"]
    B -->|"huella o torniquete"| E["El dispositivo lo envía"]
    B -->|"a mano"| F["Recepción lo busca por nombre o documento"]
    C --> G["Se busca el socio en ese gimnasio"]
    D --> G
    E --> G
    F --> G
    G --> H{"¿Su membresía está vigente?"}
    H -->|no| I["Avisa que venció"]
    H -->|sí| J["Registra la entrada"]
    J --> K["Actualiza racha y asistencias del mes"]
    J --> L["Avisa en vivo a la pantalla de recepción"]
    J --> M["Comprobante por WhatsApp, si está configurado"]
```

## 3. Cobrar una mensualidad

```mermaid
sequenceDiagram
    participant A as Administración
    participant API as API
    participant DB as Base de datos

    A->>API: registrar el pago de un socio
    API->>DB: en una sola transacción
    Note over DB: extiende el vencimiento de la membresía<br/>y guarda el movimiento
    alt algo falla
        DB-->>API: se deshace todo
        API-->>A: no se pudo cobrar
    else todo bien
        DB-->>API: confirmado
        API-->>A: pago registrado
    end
```

**Las dos escrituras van juntas o no va ninguna.** Antes eran dos operaciones
sueltas: si la segunda fallaba, quedaba un socio con la membresía extendida y sin
registro del cobro, o un cobro registrado que no le sirvió de nada. Fue una
corrección real durante la migración, no una formalidad.

## 4. Reservar una sesión uno a uno

```mermaid
sequenceDiagram
    participant S as Socio
    participant API as API
    participant DB as Base de datos

    S->>API: ¿qué horarios hay libres?
    API->>DB: disponibilidad del profesional y citas ya tomadas
    API->>API: corta la disponibilidad en turnos y resta lo ocupado
    API-->>S: turnos libres
    S->>API: reservar uno
    API->>DB: crear la cita
    alt alguien lo tomó primero
        DB-->>API: el índice único lo rechaza
        API-->>S: ese horario ya no está disponible
    else libre
        DB-->>API: reservada
        API-->>S: confirmada
        API->>API: avisa al profesional en vivo
    end
```

**Nada se precalcula.** Los turnos se arman al momento de preguntar, así que un
cambio de horario del entrenador se refleja en la consulta siguiente sin tener
que regenerar nada.

**La última palabra la tiene la base**, no la comprobación previa: entre mirar si
está libre y guardar la reserva pasa un instante, y en ese instante otro puede
tomarlo. El índice único lo impide de verdad, y el rechazo se traduce en un
mensaje claro.

## 5. Cobrar la plataforma a cada gimnasio

Este es el negocio del superadmin: los gimnasios son sus clientes.

```mermaid
flowchart TD
    A["Un gimnasio contrata un plan"] --> B{"¿Cómo se cuenta el ciclo?"}
    B -->|"mes corrido"| C["Desde el día que contrató"]
    B -->|"mes calendario"| D["Del primero al último día del mes"]
    C --> E["Se genera la factura del período"]
    D --> E
    E --> F{"¿Pagó antes del vencimiento?"}
    F -->|sí| G["Se renueva el período"]
    F -->|no| H["Días de gracia"]
    H --> I{"¿Pagó dentro de la gracia?"}
    I -->|sí| G
    I -->|no| J["El gimnasio queda desactivado"]
    J --> K["Sus cuentas no pueden entrar"]
```

Dos detalles que conviene tener presentes:

- **La desactivación se aplica al intentar entrar**, no en un proceso nocturno.
  Antes de decidir si alguien puede pasar, el sistema pone al día los
  vencimientos. Sin eso, desactivar automáticamente no tendría ningún efecto
  real: la gente seguiría entrando.
- **Las fechas se calculan en el huso del gimnasio**, no en el del servidor. Un
  vencimiento que cae a medianoche cambia de día según dónde se lo mire.
