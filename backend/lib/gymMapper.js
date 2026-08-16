/**
 * El frontend (theme.service.ts, selector de gimnasios) espera `colores` y
 * `modulos` como objetos anidados, igual que devolvía Mongoose. Postgres los
 * guarda aplanados en columnas propias.
 */

const CAMPOS_COLORES = ['primario', 'secundario', 'fondo', 'navbar', 'menu', 'dias'];
const CAMPOS_MODULOS = ['rutinas', 'progreso', 'medidas', 'pagos', 'noticias', 'cronometro'];
// map: nombre anidado -> nombre de columna aplanada (no siguen el patrón regular capitalizado).
const CAMPOS_AGENDA = {
  activa: 'agendaActiva',
  duracionMin: 'agendaDuracionMin',
  precio: 'agendaPrecio',
  horasMinimasReserva: 'agendaHorasMinimasReserva',
  horasMinimasCancelacion: 'agendaHorasMinimasCancelacion',
  diasVisibles: 'agendaDiasVisibles',
};

function toApiGym(g) {
  if (!g) return g;
  const colores = {};
  for (const campo of CAMPOS_COLORES) colores[campo] = g[`color${capitaliza(campo)}`];
  const modulos = {};
  for (const campo of CAMPOS_MODULOS) modulos[campo] = g[`modulo${capitaliza(campo)}`];
  const agenda = {};
  for (const [campo, columna] of Object.entries(CAMPOS_AGENDA)) {
    agenda[campo] = campo === 'precio' && g[columna] !== undefined ? Number(g[columna]) : g[columna];
  }

  const {
    id, colorPrimario, colorSecundario, colorFondo, colorNavbar, colorMenu, colorDias,
    moduloRutinas, moduloProgreso, moduloMedidas, moduloPagos, moduloNoticias, moduloCronometro,
    agendaActiva, agendaDuracionMin, agendaPrecio, agendaHorasMinimasReserva, agendaHorasMinimasCancelacion, agendaDiasVisibles,
    ...rest
  } = g;
  return { ...rest, _id: id, colores, modulos, agenda };
}

function capitaliza(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// { colores, modulos, agenda } anidados (posiblemente parciales) -> columnas planas.
function fromApiGymConfig({ colores, modulos, agenda } = {}) {
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
  if (agenda && typeof agenda === 'object') {
    for (const [campo, columna] of Object.entries(CAMPOS_AGENDA)) {
      if (agenda[campo] !== undefined) datos[columna] = agenda[campo];
    }
  }
  return datos;
}

module.exports = { toApiGym, fromApiGymConfig };
