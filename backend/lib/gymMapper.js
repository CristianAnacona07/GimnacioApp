/**
 * El frontend (theme.service.ts, selector de gimnasios) espera `colores` y
 * `modulos` como objetos anidados, igual que devolvía Mongoose. Postgres los
 * guarda aplanados en columnas propias.
 */

const CAMPOS_COLORES = ['primario', 'secundario', 'fondo', 'navbar', 'menu', 'dias'];
const CAMPOS_MODULOS = ['rutinas', 'progreso', 'medidas', 'pagos', 'noticias', 'cronometro'];

function toApiGym(g) {
  if (!g) return g;
  const colores = {};
  for (const campo of CAMPOS_COLORES) colores[campo] = g[`color${capitaliza(campo)}`];
  const modulos = {};
  for (const campo of CAMPOS_MODULOS) modulos[campo] = g[`modulo${capitaliza(campo)}`];

  const {
    id, colorPrimario, colorSecundario, colorFondo, colorNavbar, colorMenu, colorDias,
    moduloRutinas, moduloProgreso, moduloMedidas, moduloPagos, moduloNoticias, moduloCronometro,
    ...rest
  } = g;
  return { ...rest, _id: id, colores, modulos };
}

function capitaliza(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// { colores, modulos } anidados (posiblemente parciales) -> columnas planas.
function fromApiGymConfig({ colores, modulos } = {}) {
  const datos = {};
  if (colores && typeof colores === 'object') {
    for (const campo of CAMPOS_COLORES) {
      if (colores[campo] !== undefined) datos[`color${capitaliza(campo)}`] = colores[campo];
    }
  }
  if (modulos && typeof modulos === 'object') {
    for (const campo of CAMPOS_MODULOS) {
      if (modulos[campo] !== undefined) datos[`modulo${capitaliza(campo)}`] = modulos[campo];
    }
  }
  return datos;
}

module.exports = { toApiGym, fromApiGymConfig };
