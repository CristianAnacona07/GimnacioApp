// El frontend espera `socioId`/`profesionalId` como el objeto poblado
// ({_id, nombre, fotoUrl}) cuando la ruta los incluye, igual que el
// `.populate()` de Mongoose reemplazaba el campo in-place.
function conCita(c) {
  if (!c) return c;
  const { id, socio, profesional, socioId, profesionalId, canceladaPorUsuario, ...rest } = c;
  return {
    ...rest,
    _id: id,
    socioId: socio ? { _id: socio.id, nombre: socio.nombre, fotoUrl: socio.fotoUrl || '' } : socioId,
    profesionalId: profesional ? { _id: profesional.id, nombre: profesional.nombre, fotoUrl: profesional.fotoUrl || '' } : profesionalId,
  };
}

module.exports = { conCita };
