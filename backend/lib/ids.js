// Reemplaza mongoose.Types.ObjectId.isValid(): los ids siguen teniendo forma
// de ObjectId (24 hex) aunque ahora vivan en columnas CHAR(24) de Postgres.
function esIdValido(id) {
  return typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id);
}

module.exports = { esIdValido };
