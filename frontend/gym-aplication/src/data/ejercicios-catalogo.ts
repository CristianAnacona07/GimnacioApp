// src/app/data/ejercicios-catalogo.ts

import { D } from "@angular/cdk/keycodes";

// Definimos cómo se ve un ejercicio base
export interface EjercicioBase {
  nombre: string;
  imagenUrl: string;
  categoria: string;
  gifUrl?: string;
  descripcion?: string;
  instrucciones?: string;
  tip?: string;
}
export interface diasRutina {
  lunes: string;
  martes: string;
  miercoles: string;
  jueves: string;
  viernes: string;
  sabado: string;
  domingo: string;
}

export const DIAS_RUTINA: diasRutina = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo'
};

// Este es tu catálogo maestro. ¡Aquí añadirás todos los ejercicios que ofreces!
export const CATALOGO_EJERCICIOS: EjercicioBase[] = [
  // --- PECHO ---
  {
    nombre: 'Press Banca Plano',
    categoria: 'Pecho',
    imagenUrl: 'ejercicios/pechoImagenes/press.jpeg',
    gifUrl: 'ejercicios/pechoGif/press-plano.gif',
    descripcion: 'Acuéstate en un banco plano, baja la barra al pecho y empuja hacia arriba...',
    tip: 'Mantén los pies firmes en el suelo para mayor estabilidad.'

  },
  {
    nombre: 'Press Inclinado Mancuernas',
    categoria: 'Pecho',
    imagenUrl: 'ejercicios/pechoImagenes/press_inclinado-mancuernas.jpeg',
    gifUrl: 'ejercicios/pechoGif/press_inclinado-mancuernas.gif',
    descripcion: 'Acuéstate en un banco inclinado entre 30 y 45 grados, sosteniendo una mancuerna en cada mano a la altura del pecho. Empuja las mancuernas hacia arriba siguiendo una trayectoria ligeramente diagonal hasta que los brazos estén casi extendidos. Baja de forma controlada manteniendo tensión constante en el pecho superior.',
    tip: 'Evita juntar completamente las mancuernas arriba para no perder tensión en el pecho.'
  },
  {
    nombre: 'Aperturas con Mancuernas',
    categoria: 'Pecho',
    imagenUrl: 'ejercicios/pechoImagenes/aperturas-mancuernas.jpeg',
    gifUrl: 'ejercicios/pechoGif/aperturas-mancuernas.gif',
    descripcion: 'Acuéstate en un banco plano con una mancuerna en cada mano, abre los brazos y empuja  hacia arriba...',
    tip: 'No bloquees los codos al final del movimiento.'
  },
  {
    nombre: 'Aperturas en Máquina',
    categoria: 'Pecho',
    imagenUrl: 'ejercicios/pechoImagenes/aperturas-maquina.jpeg',
    gifUrl: 'ejercicios/pechoGif/aperturas-maquina.gif',
    descripcion: 'Siéntate en la máquina con la espalda completamente apoyada en el respaldo. Coloca los brazos en las almohadillas y junta lentamente las palancas al frente contrayendo el pecho. Regresa de forma controlada hasta sentir un estiramiento cómodo en los pectorales.',
    tip: 'Concéntrate en apretar el pecho al final del movimiento, no en empujar con los brazos.'
  },
  {
    nombre: 'Press Plano con Mancuernas',
    categoria: 'Pecho',
    imagenUrl: 'ejercicios/pechoImagenes/press-plano-mancuernas.jpeg',
    gifUrl: 'ejercicios/pechoGif/press-plano-mancuernas.gif',
    descripcion: 'Acuéstate en un banco plano con una mancuerna en cada mano apoyada a los lados del pecho. Empuja las mancuernas hacia arriba hasta casi extender los brazos y baja lentamente manteniendo el control del movimiento durante todo el recorrido.',
    tip: 'Mantén los hombros retraídos y apoyados en el banco para proteger la articulación.'
  },
  {
    nombre: 'Fondos en Paralelas',
    categoria: 'Pecho',
    imagenUrl: 'ejercicios/pechoImagenes/fondos-paralelas.jpeg',
    gifUrl: 'ejercicios/pechoGif/fondos-paralelas.gif',
    descripcion: 'Colócate en las paralelas con los brazos extendidos. Flexiona los codos bajando el cuerpo ligeramente inclinado hacia adelante hasta que sientas un estiramiento en el pecho. Empuja hacia arriba activando los pectorales para regresar a la posición inicial.',
    tip: 'Inclina el torso hacia adelante para enfatizar el trabajo en el pecho y no en los tríceps.'
  },
  {
    nombre: 'Press Inclinado en Máquina Smith',
    categoria: 'Pecho',
    imagenUrl: 'ejercicios/pechoImagenes/press-inclinado-smith.jpeg',
    gifUrl: 'ejercicios/pechoGif/press-inclinado-smith.gif',
    descripcion: 'Ajusta el banco inclinado bajo la barra de la máquina Smith. Baja la barra de forma controlada hasta la parte superior del pecho y empuja hacia arriba siguiendo el recorrido guiado de la máquina, manteniendo siempre el control del movimiento.',
    tip: 'Coloca los pies firmes en el suelo y evita bloquear los codos al subir.'
  },
  {
    nombre: 'Press Plano en Máquina',
    categoria: 'Pecho',
    imagenUrl: 'ejercicios/pechoImagenes/press-plano-maquina.jpeg',
    gifUrl: 'ejercicios/pechoGif/press-plano-maquina.gif',
    descripcion: 'Siéntate en la máquina de press plano con la espalda completamente apoyada en el respaldo y los pies firmes en el suelo. Sujeta las empuñaduras a la altura del pecho y empuja hacia adelante hasta casi extender los brazos. Regresa lentamente a la posición inicial controlando el movimiento y manteniendo la tensión constante en los músculos pectorales.',
    tip: 'No bloquees los codos al final del recorrido y mantén los hombros apoyados para evitar sobrecargas.'
  },
  {
    nombre: 'Press Inclinado en Máquina',
    categoria: 'Pecho',
    imagenUrl: 'ejercicios/pechoImagenes/press-inclinado-maquina.jpeg',
    gifUrl: 'ejercicios/pechoGif/press-inclinado-maquina.gif',
    descripcion: 'Ajusta el asiento de la máquina para que las empuñaduras queden alineadas con la parte superior del pecho. Empuja los brazos hacia adelante y ligeramente hacia arriba hasta casi extenderlos. Baja de forma controlada, enfocándote en el trabajo del pecho superior durante todo el movimiento.',
    tip: 'Mantén el pecho elevado y la espalda bien apoyada para una mejor activación del pectoral superior.'
  },
  // FIN PECHO

  //---HOMBRO---
  {
    nombre: 'Press Militar con Barra',
    categoria: 'Hombro',
    imagenUrl: 'ejercicios/hombroImagenes/press-militar-barra.jpeg',
    gifUrl: 'ejercicios/hombroGif/press-militar-barra.gif',
    descripcion: 'Siéntate en un banco con respaldo y agarra una barra con un agarre ligeramente más ancho que los hombros. Empuja la barra hacia arriba hasta extender completamente los brazos y baja de forma controlada hasta la altura de los hombros.',
    tip: 'Mantén el core activado para proteger la espalda baja durante el levantamiento.'
  },
  {
    nombre: 'Press Militar con Mancuernas',
    categoria: 'Hombro',
    imagenUrl: 'ejercicios/hombroImagenes/press-militar-mancuernas.jpeg',
    gifUrl: 'ejercicios/hombroGif/press-militar-mancuernas.gif',
    descripcion: 'Siéntate en un banco con respaldo, sosteniendo una mancuerna en cada mano a la altura de los hombros. Empuja las mancuernas hacia arriba hasta extender completamente los brazos y baja de forma controlada hasta la posición inicial.',
    tip: 'Evita arquear la espalda manteniendo el core firme durante el movimiento.'
  },
  {
    nombre: 'Press en maquina Smith',
    categoria: 'Hombro',
    imagenUrl: 'ejercicios/hombroImagenes/press-smith.jpeg',
    gifUrl: 'ejercicios/hombroGif/press-smith.gif',
    descripcion: 'Siéntate en la máquina Smith con la espalda completamente apoyada en el respaldo y los pies firmes en el suelo. Sujeta las empuñaduras a la altura del pecho y empuja hacia arriba hasta casi extender los brazos. Regresa lentamente a la posición inicial controlando el movimiento y manteniendo la tensión constante en los músculos del hombro.',
    tip: 'Mantén el core activado para evitar arquear la espalda durante el movimiento.'
  },
  {
    nombre: 'Elevaciones Laterales con Mancuernas',
    categoria: 'Hombro',
    imagenUrl: 'ejercicios/hombroImagenes/elevaciones-laterales-mancuernas.jpeg',
    gifUrl: 'ejercicios/hombroGif/elevaciones-laterales-mancuernas.gif',
    descripcion: 'De pie, con una mancuerna en cada mano a los lados del cuerpo, levanta las mancuernas hacia los lados hasta que los brazos estén paralelos al suelo. Baja de forma controlada a la posición inicial.',
    tip: 'Mantén una ligera flexión en los codos para proteger las articulaciones durante el levantamiento.'
  },
  {
    nombre: 'Elevaciones Laterales en Polea',
    categoria: 'Hombro',
    imagenUrl: 'ejercicios/hombroImagenes/elevaciones-laterales-polea.jpeg',
    gifUrl: 'ejercicios/hombroGif/elevaciones-laterales-polea.gif',
    descripcion: 'De pie, con una cuerda en la mano, levanta la cuerda hacia los lados hasta que los brazos estén paralelos al suelo. Baja de forma controlada a la posición inicial.',
    tip: 'Mantén una ligera flexión en los codos para proteger las articulaciones durante el levantamiento.'
  },
  {
    nombre: 'Elevaciones Frontales con Mancuernas',
    categoria: 'Hombro',
    imagenUrl: 'ejercicios/hombroImagenes/elevaciones-frontales-mancuernas.jpeg',
    gifUrl: 'ejercicios/hombroGif/elevaciones-frontales-mancuernas.gif',
    descripcion: 'De pie, con una mancuerna en cada mano a los lados del cuerpo, levanta las mancuernas hacia adelante hasta que los brazos estén paralelos al suelo. Baja de forma controlada a la posición inicial.',
    tip: 'Mantén una ligera flexión en los codos para proteger las articulaciones durante el levantamiento.'
  },
  {
    nombre: 'Elevaciones Frontales en Polea',
    categoria: 'Hombro',
    imagenUrl: 'ejercicios/hombroImagenes/elevaciones-frontales-polea.jpeg',
    gifUrl: 'ejercicios/hombroGif/elevaciones-frontales-polea.gif',
    descripcion: 'De pie, con una cuerda en la mano, levanta la cuerda hacia adelante hasta que los brazos estén paralelos al suelo. Baja de forma controlada a la posición inicial.',
    tip: 'Mantén una ligera flexión en los codos para proteger las articulaciones durante el levantamiento.'
  },
  {
    nombre: 'Pájaros con Mancuernas',
    categoria: 'Hombro',
    imagenUrl: 'ejercicios/hombroImagenes/pajaros-mancuernas.jpeg',
    gifUrl: 'ejercicios/hombroGif/pajaros-mancuernas.gif',
    descripcion: 'Inclina el torso hacia adelante con una mancuerna en cada mano, levanta las mancuernas hacia los lados hasta que los brazos estén paralelos al suelo. Baja de forma controlada a la posición inicial.',
    tip: 'Mantén una ligera flexión en los codos para proteger las articulaciones durante el levantamiento.'
  },
  {
    nombre: 'Aperturas maquina contraidas',
    categoria: 'Hombro',
    imagenUrl: 'ejercicios/hombroImagenes/aperturas-maquina-contraidas.jpeg',
    gifUrl: 'ejercicios/hombroGif/aperturas-maquina-contraidas.gif',
    descripcion: 'Siéntate en la máquina de aperturas con los brazos extendidos hacia adelante. Abre los brazos hacia los lados hasta que los codos estén completamente extendidos. Cierra los brazos lentamente a la posición inicial.',
    tip: 'Mantén una ligera flexión en los codos para proteger las articulaciones durante el levantamiento.'
  },
  // FIN HOMBRO

  //--- TRICEPS ---
  {
    nombre: 'Extensión de Tríceps en Máquina',
    categoria: 'Triceps',
    imagenUrl: 'ejercicios/tricepsImagenes/extenciones-triceps-maquina.jpeg',
    gifUrl: 'ejercicios/tricepsGif/extenciones-triceps-maquina.gif',
    descripcion: 'Colócate en la máquina de extensiones de tríceps con los antebrazos apoyados en las almohadillas. Empuja el peso hacia abajo hasta extender los brazos por completo, enfocándote en la contracción del tríceps, y regresa de forma lenta y controlada a la posición inicial.',
    tip: 'Mantén los codos fijos y alineados. Controla el movimiento en todo momento y ajusta el peso para priorizar la técnica sobre la carga.'
  },
  {
    nombre: 'Extensiones de Tríceps con Barra Recta o Barra V',
    categoria: 'Triceps',
    imagenUrl: 'ejercicios/tricepsImagenes/extenciones-triceps-barra-v.jpeg',
    gifUrl: 'ejercicios/tricepsGif/extenciones-triceps-barra-v.gif',
    descripcion: 'De pie frente a la polea alta, sujeta la barra recta o la barra en V según tu comodidad o el enfoque deseado. Extiende los brazos hacia abajo hasta bloquear suavemente los codos y vuelve de manera controlada a la posición inicial, manteniendo la tensión en los tríceps.',
    tip: 'Usa barra recta para un trabajo más uniforme o barra en V para mayor comodidad en muñecas y mejor aislamiento. Evita balancear el cuerpo.'
  },
  {
    nombre: 'Extensión de Tríceps en Polea Alta (De pie)',
    categoria: 'Triceps',
    imagenUrl: 'ejercicios/tricepsImagenes/extensiones-triceps-polea-alta.jpeg',
    gifUrl: 'ejercicios/tricepsGif/extensiones-triceps-polea-alta.gif',
    descripcion: 'De pie frente a la polea alta, sujeta la barra recta o barra en V según tu comodidad. Empuja el accesorio hacia abajo extendiendo completamente los brazos y regresa de forma controlada hasta la posición inicial, manteniendo la tensión en los tríceps.',
    tip: 'Mantén el torso erguido y los codos fijos a los costados. Usa barra recta para un trabajo más uniforme o barra en V para mayor comodidad en muñecas.'
  },
  {
    nombre: 'Extensión de Tríceps en Polea Alta Inclinado',
    categoria: 'Triceps',
    imagenUrl: 'ejercicios/tricepsImagenes/extensiones-triceps-polea-inclinada.jpeg',
    gifUrl: 'ejercicios/tricepsGif/extensiones-triceps-polea-inclinada.gif',
    descripcion: 'Colócate frente a la polea alta e inclina ligeramente el torso hacia adelante. Extiende los brazos empujando el accesorio en una trayectoria más horizontal, contrayendo los tríceps al final del movimiento y regresando de forma lenta y controlada.',
    tip: 'Evita balancear el cuerpo y controla la bajada. Este ángulo aumenta la tensión continua sobre el tríceps, ideal para fuerza y volumen.'
  },
  {
    nombre: 'Press Francés con Mancuernas',
    categoria: 'Triceps',
    imagenUrl: 'ejercicios/tricepsImagenes/press-frances-mancuernas.jpeg',
    gifUrl: 'ejercicios/tricepsGif/press-frances-mancuernas.gif',
    descripcion: 'Acostado en un banco plano, sujeta una mancuerna en cada mano con los brazos extendidos sobre el pecho. Flexiona los codos bajando las mancuernas hacia la cabeza y luego extiende los brazos hasta volver a la posición inicial, manteniendo la tensión en los tríceps.',
    tip: 'Mantén los codos apuntando hacia arriba y evita abrirlos. Controla la bajada para proteger los codos y maximizar el trabajo muscular.'
  },
  {
    nombre: 'Extensión Tras Nuca con Mancuernas',
    categoria: 'Triceps',
    imagenUrl: 'ejercicios/tricepsImagenes/extension-trans-nuca-mancuernas.jpeg',
    gifUrl: 'ejercicios/tricepsGif/extension-trans-nuca-mancuernas.gif',
    descripcion: 'Sentado o de pie, sujeta una mancuerna con ambas manos por encima de la cabeza. Flexiona los codos llevando la mancuerna detrás de la nuca y luego extiende los brazos hacia arriba hasta contraer completamente los tríceps.',
    tip: 'Mantén los codos cerrados y el abdomen firme. Este ejercicio enfatiza la cabeza larga del tríceps, ideal para ganar volumen.'
  },
  {
    nombre: 'Patada de Tríceps con Mancuernas',
    categoria: 'Triceps',
    imagenUrl: 'ejercicios/tricepsImagenes/patada-triceps-mancuernas.jpeg',
    gifUrl: 'ejercicios/tricepsGif/patada-triceps-mancuernas.gif',
    descripcion: 'Inclina el torso hacia adelante con la espalda recta y el brazo pegado al cuerpo. Extiende el antebrazo hacia atrás hasta estirar completamente el brazo y regresa de forma controlada a la posición inicial.',
    tip: 'Mantén el brazo superior fijo y evita mover el hombro. Usa pesos moderados para lograr una mejor contracción al final del movimiento.'
  },
  {
    nombre: 'Press Banca Agarre Cerrado',
    categoria: 'Triceps',
    imagenUrl: 'ejercicios/tricepsImagenes/press-banca-agarre-cerrado.jpeg',
    gifUrl: 'ejercicios/tricepsGif/press-banca-agarre-cerrado.gif',
    descripcion: 'Acostado en un banco plano, sujeta la barra con un agarre más estrecho que el ancho de hombros. Desciende la barra de forma controlada hacia el pecho y empuja hacia arriba extendiendo los brazos, enfocando el esfuerzo en los tríceps.',
    tip: 'Mantén los codos cerca del cuerpo y no abras demasiado el agarre. Usa cargas progresivas cuidando la técnica.'
  },
  {
    nombre: 'Fondos en Paralelas para Tríceps',
    categoria: 'Triceps',
    imagenUrl: 'ejercicios/tricepsImagenes/fondos-paralelas-triceps.jpeg',
    gifUrl: 'ejercicios/tricepsGif/fondos-paralelas-triceps.gif',
    descripcion: 'Sujétate de las barras paralelas con los brazos extendidos. Flexiona los codos bajando el cuerpo de forma controlada y luego empuja hacia arriba hasta extender completamente los brazos, manteniendo el torso lo más vertical posible.',
    tip: 'Inclina ligeramente el torso solo si es necesario y evita balancearte. Excelente ejercicio compuesto para fuerza y masa en tríceps.'
  },
  {
    nombre: 'Fondos en Banco para Tríceps',
    categoria: 'Triceps',
    imagenUrl: 'ejercicios/tricepsImagenes/fondos-banco-triceps.jpeg',
    gifUrl: 'ejercicios/tricepsGif/fondos-banco-triceps.gif',
    descripcion: 'Apoya las manos en el borde de un banco con los brazos extendidos y los pies en el suelo o sobre otro banco. Flexiona los codos bajando el cuerpo de forma controlada y luego empuja hacia arriba hasta extender completamente los brazos.',
    tip: 'Mantén los codos apuntando hacia atrás y evita bajar demasiado para no sobrecargar los hombros. Ideal para principiantes.'
  },
  {
    nombre: 'Extensión de Tríceps en Maquina',
    categoria: 'Triceps',
    imagenUrl: 'ejercicios/tricepsImagenes/extension-triceps-maquina.jpeg',
    gifUrl: 'ejercicios/tricepsGif/extension-triceps-maquina.gif',
    descripcion: 'Siéntate en la máquina de extensiones de tríceps con los antebrazos apoyados en las almohadillas. Empuja el peso hacia abajo hasta extender completamente los brazos y regresa de forma lenta y controlada a la posición inicial.',
    tip: 'Mantén los codos fijos y evita mover el torso. Usa pesos moderados para lograr una mejor contracción al final del movimiento.'
  },
  //FIN TRICEPS

  // --- ESPALDA ---
  {
    nombre: 'Dominadas',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/dominadas.jpeg',
    gifUrl: 'ejercicios/espaldaGif/dominadas.gif',
    descripcion: 'Cuelga de la barra con los brazos completamente extendidos y un agarre al ancho de los hombros o ligeramente más amplio. Tira del cuerpo hacia arriba flexionando los codos hasta que el mentón supere la barra, y desciende de forma controlada hasta la posición inicial.',
    tip: 'Mantén el cuerpo recto y evita balancearte. Concéntrate en llevar el pecho hacia la barra para activar mejor los músculos de la espalda.'
  },
  {
    nombre: 'Jalón al Pecho',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/jalon-pecho.jpeg',
    gifUrl: 'ejercicios/espaldaGif/jalon-pecho.gif',
    descripcion: 'Siéntate en la máquina de jalones con las rodillas aseguradas bajo los soportes. Agarra la barra con un agarre amplio y tira de ella hacia la parte superior del pecho, manteniendo la espalda recta y los codos apuntando hacia abajo. Regresa lentamente a la posición inicial controlando el movimiento.',
    tip: 'Evita balancear el cuerpo para maximizar el trabajo en los dorsales.'
  },
  {
    nombre: 'Jalón al Pecho con Agarre Cerrado',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/jalon-pecho-agarre-cerrado.jpeg',
    gifUrl: 'ejercicios/espaldaGif/jalon-pecho-agarre-cerrado.gif',
    descripcion: 'Siéntate en la máquina de polea alta y ajusta las rodillas bajo los soportes. Sujeta el accesorio con un agarre cerrado y neutro. Tira del accesorio hacia la parte alta del pecho llevando los codos hacia abajo y atrás, manteniendo el pecho elevado y la espalda recta. Regresa de forma lenta y controlada a la posición inicial.',
    tip: 'Evita balancear el cuerpo y no uses impulso. Concéntrate en llevar los codos hacia abajo para activar mejor los dorsales.'
  },
  {
    nombre: 'Remo Horizontal Cerrado',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/remo-horizontal-cerrado.jpeg',
    gifUrl: 'ejercicios/espaldaGif/remo-horizontal-cerrado.gif',
    descripcion: 'Siéntate en la máquina de remo horizontal con los pies apoyados en el suelo y agarra la barra con un agarre cerrado. Tira de la barra hacia el abdomen manteniendo los codos apuntando hacia atrás y la espalda recta. Regresa lentamente a la posición inicial.',
    tip: 'Mantén los codos fijos y evita mover el torso para enfocar mejor el trabajo en los dorsales.'
  },
  {
    nombre: 'Pull Over en Polea Alta',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/Pull-over.jpeg',
    gifUrl: 'ejercicios/espaldaGif/Pull-over.gif',
    descripcion: 'De pie frente a la polea alta, sujeta la cuerda con ambas manos. Con los brazos ligeramente flexionados, tira de la cuerda hacia abajo y hacia adelante hasta que las manos estén a la altura de los muslos. Regresa de forma controlada a la posición inicial.',
    tip: 'Mantén una ligera flexión en los codos y evita usar el impulso para maximizar el trabajo en los dorsales.'
  },
  {
    nombre: 'Remo con Barra',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/remo-barra.jpeg',
    gifUrl: 'ejercicios/espaldaGif/remo-barra.gif',
    descripcion: 'Agarra una barra con un agarre cerrado y tira de ella hacia el abdomen manteniendo la espalda recta. Asegúrate de que los codos estén apuntando hacia atrás durante todo el movimiento.',
    tip: 'Mantén la espalda recta y evita mover el cuerpo para enfocar el trabajo en los dorsales.'
  },
  {
    nombre: 'Remo Con Mancuernas a Una Mano',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/remo-mancuernas-una-mano.jpeg',
    gifUrl: 'ejercicios/espaldaGif/remo-mancuernas-una-mano.gif',
    descripcion: 'Agarra una mancuerna con una mano y colócala sobre el muslo opuesto. Mantén el torso recto y tira de la mancuerna hacia el abdomen, manteniendo los codos apuntando hacia atrás. Regresa de forma controlada a la posición inicial.',
    tip: 'Mantén la espalda recta y evita mover el cuerpo para enfocar el trabajo en los dorsales.'
  },
  {
    nombre: 'Remo en Polea Baja',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/remo-polea-baja.jpeg',
    gifUrl: 'ejercicios/espaldaGif/remo-polea-baja.gif',
    descripcion: 'Colócate de pie frente a la polea baja con el torso ligeramente inclinado hacia adelante y las rodillas semiflexionadas. Sujeta el accesorio con ambas manos y tira de él hacia el abdomen, llevando los codos hacia atrás y manteniendo la espalda recta. Regresa lentamente a la posición inicial de forma controlada.',
    tip: 'Evita encorvar la espalda o usar impulso. Concéntrate en apretar los músculos de la espalda al final del movimiento.'
  },
  {
    nombre: 'Remo en Punta o T-Bar row',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/remo-punta-tbar.jpeg',
    gifUrl: 'ejercicios/espaldaGif/remo-punta-tbar.gif',
    descripcion: 'Colócate de pie frente a la barra T-Bar, agarra la barra con ambas manos y tira de ella hacia el abdomen, llevando los codos hacia atrás y manteniendo la espalda recta. Regresa lentamente a la posición inicial de forma controlada.',
    tip: 'Evita encorvar la espalda o usar impulso. Concéntrate en apretar los músculos de la espalda al final del movimiento.'
  },
  {
    nombre: 'Peso Muerto con Barra',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/peso-muerto-barra.jpeg',
    gifUrl: 'ejercicios/espaldaGif/peso-muerto-barra.gif',
    descripcion: 'Colócate de pie con los pies a la anchura de los hombros y la barra frente a las tibias. Agarra la barra con ambas manos, mantén la espalda recta y el pecho elevado. Levanta la barra extendiendo caderas y rodillas al mismo tiempo. Baja la barra de forma controlada manteniéndola cerca del cuerpo.',
    tip: 'Mantén la espalda neutra y el abdomen firme durante todo el movimiento. Evita redondear la espalda y no rebotes la barra contra el suelo.'
  },
  {
    nombre: 'Peso Muerto con Mancuernas',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/peso-muerto-mancuernas.jpeg',
    gifUrl: 'ejercicios/espaldaGif/peso-muerto-mancuernas.gif',
    descripcion: 'Colócate de pie con los pies a la anchura de los hombros y una mancuerna en cada mano. Mantén la espalda recta y baja las mancuernas deslizando los brazos a lo largo de las piernas hasta sentir tensión en la parte posterior. Luego extiende las caderas para volver a la posición inicial.',
    tip: 'Ideal para principiantes. Controla el movimiento y concéntrate en empujar con las caderas, no en bajar demasiado.'
  },
  {
    nombre: 'Jalón Frontal en Máquina (Discos)',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/jalon-frontal-maquina.jpeg',
    gifUrl: 'ejercicios/espaldaGif/jalon-frontal-maquina.gif',
    descripcion: 'Siéntate en la máquina con los muslos sujetos por las almohadillas. Sujeta los agarres con las palmas hacia adelante. Tira de las palancas hacia abajo hasta que los codos lleguen a los costados, apretando las escápulas. Regresa lentamente a la posición inicial permitiendo que los brazos se extiendan por completo.',
    tip: 'Esta máquina permite trabajar de forma bilateral (ambos brazos a la vez) o unilateral (un brazo a la vez) para un mayor enfoque. Mantén el pecho arriba durante todo el movimiento.'
  },
  {
    nombre: 'Banco de Extensiones Lumbares',
    categoria: 'Espalda',
    imagenUrl: 'ejercicios/espaldaImagenes/extensiones-lumbares.jpeg',
    gifUrl: 'ejercicios/espaldaGif/extensiones-lumbares.gif',
    descripcion: 'En el banco de extensiones, baja el torso de forma controlada y elévalo hasta alinear la espalda con las piernas, fortaleciendo la zona lumbar.',
    tip: 'No hiperextiendas demasiado la espalda hacia atrás al subir; mantén el movimiento controlado.'
  },
  // FIN ESPALDA

  // --- BICEPS ---
  {
    nombre: 'Curl de Bíceps con Barra Z',
    categoria: 'Biceps',
    imagenUrl: 'ejercicios/bicepsImagenes/curl-biceps-barra-z.jpeg',
    gifUrl: 'ejercicios/bicepsGif/curl-biceps-barra-z.gif',
    descripcion: 'Colócate de pie con los pies separados a la anchura de los hombros, sujetando una barra Z con ambas manos. Levanta la barra hacia los hombros manteniendo los codos fijos y el brazo recto. Baja lentamente la barra controlando el movimiento.',
    tip: 'Mantén los codos fijos y evita moverlos durante todo el movimiento.'
  },
  {
    nombre: 'Curl de Bíceps con Barra Recta',
    categoria: 'Biceps',
    imagenUrl: 'ejercicios/bicepsImagenes/curl-biceps-barra-recta.jpeg',
    gifUrl: 'ejercicios/bicepsGif/curl-biceps-barra-recta.gif',
    descripcion: 'Colócate de pie con los pies separados a la anchura de los hombros, sujetando una barra recta con ambas manos. Levanta la barra hacia los hombros manteniendo los codos fijos y el brazo recto. Baja lentamente la barra controlando el movimiento.',
    tip: 'Mantén los codos fijos y evita moverlos durante todo el movimiento.'
  },
  {
    nombre: 'Curl de Bíceps Maquina Scott',
    categoria: 'Biceps',
    imagenUrl: 'ejercicios/bicepsImagenes/Curl Predicador (Banco Scott).jpeg',
    gifUrl: 'ejercicios/bicepsGif/Curl Predicador (Banco Scott).gif',
    descripcion: 'Siéntate en la máquina Scott con los brazos extendidos y los codos fijos. Levanta las mancuernas hacia los hombros manteniendo los codos fijos. Baja lentamente controlando el movimiento.',
    tip: 'Mantén los codos fijos y evita moverlos durante todo el movimiento.'
  },
  {
    nombre: 'Curl de Bíceps Banco Scott barra Z',
    categoria: 'Biceps',
    imagenUrl: 'ejercicios/bicepsImagenes/curl-biceps-banco-scott-barra-z.jpeg',
    gifUrl: 'ejercicios/bicepsGif/curl-biceps-banco-scott-barra-z.gif',
    descripcion: 'Siéntate en el banco Scott con los brazos extendidos y los codos fijos. Levanta las mancuernas hacia los hombros manteniendo los codos fijos. Baja lentamente controlando el movimiento.',
    tip: 'Mantén los codos fijos y evita moverlos durante todo el movimiento.'
  },
  {
    nombre: 'Curl de Bíceps en Banco Scott con Mancuerna (Una Mano)',
    categoria: 'Biceps',
    imagenUrl: 'ejercicios/bicepsImagenes/curl-biceps-banco-scott-mancuernas.jpeg',
    gifUrl: 'ejercicios/bicepsGif/curl-biceps-banco-scott-mancuernas.gif',
    descripcion: 'Siéntate en el banco Scott y apoya completamente el brazo sobre el respaldo. Con una mancuerna en la mano, flexiona el codo levantando el peso hacia el hombro, manteniendo el brazo fijo. Baja lentamente de forma controlada y luego repite con el otro brazo.',
    tip: 'Realiza el movimiento de forma lenta y controlada. Evita despegar el brazo del banco para mantener la tensión en el bíceps.'
  },

{
  nombre: 'Curl Concentrado con Mancuerna',
  categoria: 'Biceps',
  imagenUrl: 'ejercicios/bicepsImagenes/curl-biceps-concentrado.jpeg',
  gifUrl: 'ejercicios/bicepsGif/curl-biceps-concentrado.gif',
  descripcion: 'Siéntate en un banco con las piernas separadas. Sujeta una mancuerna con una mano y apoya el codo en la parte interna del muslo. Flexiona el codo levantando la mancuerna hacia el hombro de forma controlada y luego baja lentamente. Completa las repeticiones y cambia de brazo.',
  tip: 'Mantén el codo apoyado y evita mover el hombro. Realiza el movimiento lento para una mejor contracción del bíceps.'
},
{
  nombre: 'Curl Martillo con Mancuernas',
  categoria: 'Biceps',
  imagenUrl: 'ejercicios/bicepsImagenes/curl-martillo-mancuernas.jpeg',
  gifUrl: 'ejercicios/bicepsGif/curl-martillo-mancuernas.gif',
  descripcion: 'De pie o sentado, sujeta una mancuerna en cada mano con las palmas mirándose entre sí. Flexiona el codo levantando una mancuerna hacia el hombro de forma controlada, luego baja lentamente y repite con el otro brazo.',
  tip: 'Mantén los codos pegados al cuerpo y evita balancearte. Realizar el ejercicio sentado mejora la estabilidad y el control del movimiento.'
},
{
  nombre: 'Curl Martillo con Cuerda',
  categoria: 'Biceps',
  imagenUrl: 'ejercicios/bicepsImagenes/curl-martillo-cuerda.jpeg',
  gifUrl: 'ejercicios/bicepsGif/curl-martillo-cuerda.gif',
  descripcion: 'Colócate de pie frente a la polea baja y sujeta la cuerda con ambas manos, manteniendo las palmas enfrentadas. Flexiona los codos llevando la cuerda hacia los hombros de forma controlada y luego baja lentamente hasta la posición inicial.',
  tip: 'Mantén los codos pegados al cuerpo y evita balancearte. Controla la bajada para mantener la tensión constante en los bíceps y braquial.'
},
{
  nombre: 'Curl Inclinado Alterno con Mancuernas',
  categoria: 'Biceps',
  imagenUrl: 'ejercicios/bicepsImagenes/curl-inclinado-alterno-supinacion.jpeg',
  gifUrl: 'ejercicios/bicepsGif/curl-inclinado-alterno-supinacion.gif',
  descripcion: 'Siéntate en un banco inclinado y apoya completamente la espalda. Sujeta una mancuerna en cada mano con los brazos extendidos. Flexiona un brazo llevando la mancuerna hacia el hombro mientras giras la muñeca (supinación). Baja de forma controlada y repite con el otro brazo.',
  tip: 'Mantén los hombros apoyados en el banco y evita balancear el cuerpo. Controla la bajada para aumentar la activación del bíceps.'
},
{
  nombre: 'Curl Aislado en Polea Baja',
  categoria: 'Biceps',
  imagenUrl: 'ejercicios/bicepsImagenes/curl-aislado-polea-baja.jpeg',
  gifUrl: 'ejercicios/bicepsGif/curl-aislado-polea-baja.gif',
  descripcion: 'Colócate de pie frente a la polea baja y sujeta el accesorio con una sola mano. Flexiona el codo llevando la mano hacia el hombro de forma controlada, manteniendo el brazo pegado al cuerpo. Regresa lentamente a la posición inicial.',
  tip: 'Mantén el codo fijo y evita balancear el cuerpo. La polea permite mantener tensión constante durante todo el recorrido.'
},
// FIN BICEPS

  // --- PIERNA ---
  {
    nombre: 'Sentadilla Libre',
    categoria: 'Pierna',
    imagenUrl: 'ejercicios/piernaImagenes/sentadilla-libre.jpeg',
    gifUrl: 'ejercicios/piernaGif/sentadilla-libre.gif',
    descripcion: 'Colócate de pie con los pies a la anchura de los hombros y la barra apoyada sobre los trapecios. Flexiona las rodillas y caderas para bajar el cuerpo hasta que los muslos estén paralelos al suelo. Empuja con los talones para regresar a la posición inicial.',
    tip: 'Mantén el pecho elevado y la espalda recta durante todo el movimiento. Evita que las rodillas se adelanten demasiado sobre los pies.'
  },
{
  nombre: 'Sentadilla libre En Máquina Smith',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/sentadilla-maquina-smith.jpeg',
  gifUrl: 'ejercicios/piernaGif/sentadilla-maquina-smith.gif',
  descripcion: 'Colócate de pie con los pies a la anchura de los hombros y la barra de la máquina Smith apoyada sobre los trapecios. Flexiona las rodillas y caderas para bajar el cuerpo hasta que los muslos estén paralelos al suelo. Empuja con los talones para regresar a la posición inicial.',
  tip: 'Mantén el pecho elevado y la espalda recta durante todo el movimiento. Evita que las rodillas se adelanten demasiado sobre los pies.'
},
{
  nombre: 'Prensa de Piernas',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/prensa-piernas.jpeg',
  gifUrl: 'ejercicios/piernaGif/prensa-piernas.gif',
  descripcion: 'Siéntate en la prensa de piernas con la espalda completamente apoyada y coloca los pies sobre la plataforma a la anchura de los hombros. Empuja la plataforma extendiendo las piernas sin bloquear las rodillas y luego baja de forma lenta y controlada hasta la posición inicial.',
  tip: 'Mantén la espalda apoyada en el respaldo y controla la bajada. Evita bloquear las rodillas para proteger las articulaciones y mantener la tensión en los músculos.'
},
{
  nombre: 'Extensión de Cuádriceps en Máquina',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/extension-cuadriceps.jpeg',
  gifUrl: 'ejercicios/piernaGif/extension-cuadriceps.gif',
  descripcion: 'Siéntate en la máquina de extensión de cuádriceps con la espalda apoyada en el respaldo y las piernas colocadas detrás de los rodillos. Extiende las piernas elevando el peso hasta quedar casi rectas y luego baja lentamente de forma controlada hasta la posición inicial.',
  tip: 'No bloquees completamente las rodillas. Controla la bajada y concéntrate en contraer los cuádriceps en la parte alta del movimiento.'
},
{
  nombre: 'Sentadilla Hack',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/sentadilla-hack.jpeg',
  gifUrl: 'ejercicios/piernaGif/sentadilla-hack.gif',
  descripcion: 'Colócate en la máquina de sentadilla hack con la espalda apoyada en el respaldo y los hombros debajo de las almohadillas. Sitúa los pies sobre la plataforma a la anchura de los hombros. Flexiona las rodillas bajando el cuerpo de forma controlada y luego empuja la plataforma hacia arriba hasta extender las piernas sin bloquear las rodillas.',
  tip: 'Mantén la espalda apoyada en todo momento y controla la bajada. Colocar los pies un poco más adelante aumenta el trabajo en los cuádriceps.'
},
{
  nombre: 'Sentadilla Búlgara',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/sentadilla-bulgara.jpeg',
  gifUrl: 'ejercicios/piernaGif/sentadilla-bulgara.gif',
  descripcion: 'Colócate de espaldas a un banco y apoya el empeine de un pie sobre él. Da un paso hacia adelante con la otra pierna. Flexiona la rodilla delantera bajando el cuerpo de forma controlada hasta que el muslo quede casi paralelo al suelo y luego empuja hacia arriba para volver a la posición inicial. Cambia de pierna al completar las repeticiones.',
  tip: 'Mantén el torso erguido y el abdomen firme. Comienza sin peso para aprender la técnica y mejorar el equilibrio.'
},
{
  nombre: 'Sentadilla con Mancuernas',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/sentadilla-mancuernas.jpeg',
  gifUrl: 'ejercicios/piernaGif/sentadilla-mancuernas.gif',
  descripcion: 'Colócate de pie con los pies a la anchura de los hombros y sujeta una mancuerna en cada mano a los costados del cuerpo. Flexiona las rodillas y las caderas bajando el cuerpo de forma controlada, manteniendo la espalda recta y el pecho erguido. Luego empuja con los talones para volver a la posición inicial.',
  tip: 'Mantén las rodillas alineadas con los pies y evita inclinar demasiado el torso. Comienza con pesos ligeros para asegurar una buena técnica.'
},
{
  nombre: 'Curl Femoral Tumbado',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/curl-femoral-tumbado.jpeg',
  gifUrl: 'ejercicios/piernaGif/curl-femoral-tumbado.gif',
  descripcion: 'Acuéstate boca abajo en la máquina de curl femoral y coloca los tobillos debajo de los rodillos. Sujeta las agarraderas y flexiona las rodillas llevando los talones hacia los glúteos de forma controlada. Luego baja lentamente las piernas hasta la posición inicial.',
  tip: 'Mantén la cadera apoyada en el banco y evita levantarla durante el movimiento. Controla la bajada para aumentar el trabajo en los femorales.'
},
{
  nombre: 'Hip Thrust con Barra',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/hip-thrust-barra.jpeg',
  gifUrl: 'ejercicios/piernaGif/hip-thrust-barra.gif',
  descripcion: 'Apoya la parte superior de la espalda en un banco y coloca la barra sobre la cadera. Flexiona las rodillas con los pies apoyados en el suelo. Empuja la cadera hacia arriba contrayendo los glúteos hasta que el torso quede alineado con las piernas. Baja de forma controlada hasta la posición inicial.',
  tip: 'Mantén el abdomen firme y evita arquear la espalda baja. Aprieta los glúteos en la parte alta del movimiento.'
},
{
  nombre: 'Hip Thrust en Máquina',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/hip-thrust-maquina.jpeg',
  gifUrl: 'ejercicios/piernaGif/hip-thrust-maquina.gif',
  descripcion: 'Colócate en la máquina de hip thrust con la espalda apoyada y los pies firmes en la plataforma. Empuja la carga elevando la cadera hasta extender completamente las caderas y luego desciende de forma lenta y controlada.',
  tip: 'Ajusta el asiento para que el movimiento sea cómodo. Controla la bajada y concéntrate en la activación de los glúteos.'
},
{
  nombre: 'Abducción de Cadera en Máquina (Piernas Abiertas)',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/abduccion-cadera-maquina.jpeg',
  gifUrl: 'ejercicios/piernaGif/abduccion-cadera-maquina.gif',
  descripcion: 'Siéntate en la máquina de abducción con la espalda apoyada y las piernas juntas al inicio. Empuja las piernas hacia afuera contra las almohadillas hasta donde te sea cómodo y luego regresa lentamente a la posición inicial.',
  tip: 'Realiza el movimiento de forma controlada y concéntrate en contraer los glúteos. No uses impulso.'
},
{
  nombre: 'Aducción de Cadera en Máquina (Piernas Cerradas)',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/aduccion-cerrada-maquina.jpeg',
  gifUrl: 'ejercicios/piernaGif/aduccion-cerrada-maquina.gif',
  descripcion: 'Siéntate en la máquina de aducción con la espalda apoyada y las piernas abiertas. Junta las piernas empujando las almohadillas hacia el centro de forma controlada y luego vuelve lentamente a la posición inicial.',
  tip: 'Mantén el torso estable y controla la bajada. Concéntrate en el trabajo de la parte interna de los muslos.'
},
{
  nombre: 'Patada de Glúteo en Polea',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/patada-gluteo-polea.jpeg',
  gifUrl: 'ejercicios/piernaGif/patada-gluteo-polea.gif',
  descripcion: 'Colócate de pie frente a la polea baja y sujétate de la estructura para mantener el equilibrio. Coloca el tobillo en el agarre de la polea y extiende la pierna hacia atrás de forma controlada. Regresa lentamente a la posición inicial y luego cambia de pierna.',
  tip: 'Aprieta el glúteo al final del movimiento, mantén el abdomen firme y evita arquear la espalda.'
},
{
  nombre: 'Elevación de Talones de Pie',
  categoria: 'Pierna',
  imagenUrl: 'ejercicios/piernaImagenes/elevacion-talones-pie.jpeg',
  gifUrl: 'ejercicios/piernaGif/elevacion-talones-pie.gif',
  descripcion: 'Colócate de pie con los pies separados a la anchura de los hombros. Eleva los talones apoyándote sobre la punta de los pies hasta quedar de puntillas. Desciende lentamente hasta apoyar completamente los pies en el suelo.',
  tip: 'Mantén el abdomen firme y realiza el movimiento de forma controlada, subiendo y bajando lentamente para trabajar mejor los gemelos.'
},
// FIN PIERNA

  // --- ABDOMINALES ---
  {
    nombre: 'Plancha Tradicional',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/plancha-tradicional.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/plancha-tradicional.gif',
    descripcion: 'Mantén el cuerpo en línea recta apoyado sobre los antebrazos y las puntas de los pies, activando el core.',
    tip: 'No dejes que la cadera caiga ni se eleve demasiado.'
  },
  {
    nombre: 'Plancha Lateral',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/plancha-lateral.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/plancha-lateral.gif',
    descripcion: 'Apóyate sobre un antebrazo de lado, manteniendo el cuerpo recto y la cadera elevada.',
    tip: 'Mantén el cuello alineado con la columna.'
  },
  {
    nombre: 'Rueda Abdominal',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/rueda-abdominal.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/rueda-abdominal.gif',
    descripcion: 'Arrodillado, desliza la rueda hacia adelante extendiendo el cuerpo y regresa usando los abdominales.',
    tip: 'No arquees la espalda baja al extenderte.'
  },
  {
    nombre: 'Crunches',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/crunches.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/crunches.gif',
    descripcion: 'Acostado, eleva ligeramente los hombros del suelo contrayendo el abdomen superior.',
    tip: 'No tires del cuello con las manos.'
  },
  {
    nombre: 'Crunch en Polea Alta',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/crunches-polea-alta.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/crunches-polea-alta.gif',
    descripcion: 'Arrodillado frente a la polea, sujeta la cuerda y flexiona el torso hacia abajo contrayendo el abdomen.',
    tip: 'Mueve el torso, no los brazos.'
  },
  {
    nombre: 'Sit-ups',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/SIT-UPS.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/SIT-UPS.gif',
    descripcion: 'Acostado con rodillas flexionadas, eleva el torso completo hasta quedar sentado.',
    tip: 'Controla la bajada para mayor efectividad.'
  },
  {
    nombre: 'Ab Coaster',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/Ab-Coaster-Machine Chico.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/ab-coaster.gif',
    descripcion: 'En la máquina Ab Coaster, eleva las rodillas hacia el pecho deslizando el soporte curvo.',
    tip: 'Evita usar el impulso de las piernas.'
  },
  {
    nombre: 'Elevación de Piernas Colgado',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/ELEVACIONES-PIERNA-COLGADO.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/ELEVACIONES-PIERNA-COLGADO.gif',
    descripcion: 'Colgado de una barra, eleva las piernas (rectas o flexionadas) hasta la altura de la cadera.',
    tip: 'Evita balancear el cuerpo.'
  },
  {
    nombre: 'Elevación de Piernas Acostado',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/elevaciones-piernas-acostado.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/elevaciones-piernas-acostado.gif',
    descripcion: 'Acostado boca arriba, eleva las piernas juntas hasta 90 grados y baja sin tocar el suelo.',
    tip: 'Mantén la espalda baja pegada al suelo.'
  },
  {
    nombre: 'Tijeras',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/tijeras.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/tijeras.gif',
    descripcion: 'Acostado, alterna el cruce de piernas arriba y abajo a pocos centímetros del suelo.',
    tip: 'Mantén las piernas bien extendidas.'
  },
  {
    nombre: 'Twist Ruso',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/twist-ruso.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/twist-ruso.gif',
    descripcion: 'Sentado con pies elevados, rota el torso de lado a lado (puedes usar peso).',
    tip: 'Sigue el movimiento con la mirada.'
  },
  {
    nombre: 'Toques de Talón',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/toques-talon.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/toques-talon.gif',
    descripcion: 'Acostado con rodillas flexionadas, toca alternamente tus talones con las manos.',
    tip: 'Mantén los hombros ligeramente elevados del suelo.'
  },
  {
    nombre: 'Crunch Lateral',
    categoria: 'Abdominales',
    imagenUrl: 'ejercicios/abdominalesImagenes/crunch-lateral.jpeg',
    gifUrl: 'ejercicios/abdominalesGif/crunch-lateral.gif',
    descripcion: 'Acostado de lado, eleva el torso lateralmente para trabajar los oblicuos.',
    tip: 'Concéntrate en la contracción lateral.'
  }
  // FIN ABDOMINALES
];

// Extraemos la lista de categorías únicas para las pestañas (Tabs)
// Esto genera automáticamente: ['Pecho', 'Espalda', 'Pierna', 'Brazos']
export const CATEGORIAS_UNICAS = [...new Set(CATALOGO_EJERCICIOS.map(e => e.categoria))];
