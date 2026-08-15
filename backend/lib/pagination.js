/**
 * Paginación compatible hacia atrás (mismo contrato que tenían las 6 copias
 * repetidas en las rutas de Mongoose): sin `?page` devuelve un array plano;
 * con `?page` devuelve `{ data, total, page, limit, pages }`.
 */
async function paginar(req, delegate, { where, orderBy, include, select, defaultLimit = 20 } = {}) {
  const usaPaginacion = req.query.page !== undefined;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));

  if (!usaPaginacion) {
    return delegate.findMany({ where, orderBy, include, select });
  }

  const [data, total] = await Promise.all([
    delegate.findMany({ where, orderBy, include, select, skip: (page - 1) * limit, take: limit }),
    delegate.count({ where }),
  ]);

  return { data, total, page, limit, pages: Math.ceil(total / limit) };
}

module.exports = { paginar };
