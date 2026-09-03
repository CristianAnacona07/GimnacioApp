const { getPrismaClient } = require('../prisma/client');
const { emitirAGym } = require('../helpers/tiempoReal');

const prisma = getPrismaClient();

// Días restantes de membresía (0 si ya venció o no tiene fecha).
function diasRestantes(fechaVencimiento) {
  if (!fechaVencimiento) return 0;
  const dias = Math.ceil((new Date(fechaVencimiento) - new Date()) / (1000 * 60 * 60 * 24));
  return dias > 0 ? dias : 0;
}

/**
 * Registra el ingreso de un socio si su membresía está vigente. No cuenta dos
 * veces la misma asistencia del día. La usan tanto el check-in manual de
 * recepción como el control de acceso automático (huella), para no repetir
 * esta lógica en los dos sitios.
 *
 * `sedeId` es por qué puerta entró, y es el único dato que separa la recepción
 * de un local de la del otro. Quien llama lo resuelve según su camino: el
 * torniquete pone la sede donde está instalado, y recepción la del empleado que
 * registra. Puede venir en null: un gimnasio de un solo local no tiene sedes, y
 * la asistencia se guarda igual que siempre.
 */
async function registrarIngreso({ gymId, socio, metodo, registradoPor = null, sedeId = null }) {
  const dias = diasRestantes(socio.fechaVencimiento);
  const estado = dias > 0 ? 'activo' : 'vencido';

  if (estado === 'vencido') {
    return { permitido: false, dias: 0, estado, yaHoy: false, asistenciasMes: socio.asistenciasMes || 0 };
  }

  const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
  const yaHoy = await prisma.asistencia.findFirst({
    where: { gymId, usuarioId: socio.id, fecha: { gte: inicioDia } },
    select: { id: true }
  });

  let asistenciasMes = socio.asistenciasMes || 0;
  if (!yaHoy) {
    await prisma.asistencia.create({ data: { gymId, usuarioId: socio.id, metodo, registradoPor, sedeId } });
    asistenciasMes += 1;
    await prisma.user.update({ where: { id: socio.id }, data: { asistenciasMes } });

    // Aviso en vivo a las pantallas de recepción del gimnasio.
    emitirAGym(gymId, 'asistencia:nueva', {
      socio: { _id: socio.id, nombre: socio.nombre, fotoUrl: socio.fotoUrl || '' },
      fecha: new Date().toISOString(),
      metodo,
    });
  }

  return { permitido: true, dias, estado, yaHoy: !!yaHoy, asistenciasMes };
}

module.exports = { diasRestantes, registrarIngreso };
