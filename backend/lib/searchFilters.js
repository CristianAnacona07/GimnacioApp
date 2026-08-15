/**
 * Reemplaza las 3 implementaciones de búsqueda por regex que había en
 * buscador.js, admin.js y asistencia.js. `ILIKE`/`contains insensitive` es el
 * equivalente directo de la regex case-insensitive que usaba Mongo; los
 * campos de coincidencia exacta (codigoAcceso) se quedan como `=`.
 */
function ilikeContains(field, term) {
  return { [field]: { contains: term, mode: 'insensitive' } };
}

/** Filtro de personas (nombre/email/identificación/código exacto) dentro de un gym. */
function personaSearchWhere(gymId, q) {
  return {
    gymId,
    OR: [
      ilikeContains('nombre', q),
      ilikeContains('email', q),
      ilikeContains('identificacion', q),
      { codigoAcceso: q },
    ],
  };
}

module.exports = { ilikeContains, personaSearchWhere };
