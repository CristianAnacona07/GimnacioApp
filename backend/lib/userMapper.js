/**
 * El frontend (no tocado en esta migración) espera la forma que devolvía
 * Mongoose: `_id`, `datosPersonales: {...}` y `stats: {...}` anidados. Postgres
 * los guarda aplanados en columnas propias, así que hay que reconstruir la
 * forma de ida (lecturas) y aplanar la de vuelta (escrituras) en cada borde.
 */

const CAMPOS_DATOS_PERSONALES = ['identificacion', 'fechaNacimiento', 'sexo', 'pesoActual', 'altura', 'telefono'];
const CAMPOS_STATS = ['racha', 'asistenciasMes'];

// Fila de Prisma (aplanada) -> forma legacy que espera el frontend.
function toApiUser(u) {
  if (!u) return u;
  const datosPersonales = {};
  for (const campo of CAMPOS_DATOS_PERSONALES) datosPersonales[campo] = u[campo] ?? (campo === 'pesoActual' || campo === 'altura' ? 0 : '');
  const stats = {};
  for (const campo of CAMPOS_STATS) stats[campo] = u[campo] ?? 0;

  const { id, identificacion, fechaNacimiento, sexo, pesoActual, altura, telefono, racha, asistenciasMes, ...rest } = u;
  return { ...rest, _id: id, datosPersonales, stats };
}

// Payload legacy (posible `datosPersonales: {...}` anidado) -> columnas planas
// listas para pasarle a Prisma. Solo incluye lo que venga presente.
function fromApiDatosPersonales(datosPersonales) {
  if (!datosPersonales || typeof datosPersonales !== 'object') return {};
  const datos = {};
  for (const campo of CAMPOS_DATOS_PERSONALES) {
    if (datosPersonales[campo] !== undefined) datos[campo] = datosPersonales[campo];
  }
  return datos;
}

module.exports = { toApiUser, fromApiDatosPersonales };
