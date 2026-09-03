const { getPrismaClient } = require('../prisma/client');

const prisma = getPrismaClient();

const MAX_NOMBRE = 60;

/**
 * Comprueba que una sede exista y sea del gimnasio del token.
 *
 * La sede NO viaja en el JWT (es un filtro adentro del gimnasio, no una
 * frontera), así que llega desde el cliente y hay que validarla en cada uso:
 * sin esto, alguien podría pedir la sede de otra empresa y convertir un filtro
 * en una filtración.
 *
 * Devuelve la sede, o null si no existe o es de otro gimnasio.
 */
async function sedeDelGym(gymId, sedeId) {
  if (!gymId || !sedeId) return null;
  return prisma.sede.findFirst({ where: { id: String(sedeId), gymId } });
}

/**
 * Decide qué significa el parámetro `sede` de una consulta, sin tocar la base.
 * Ausente, vacío o "todas" = no filtrar, que es lo que ven los gimnasios de un
 * solo local y lo que hace que esto no cambie nada para ellos.
 */
function interpretarParametroSede(valor) {
  if (valor === undefined || valor === null) return { filtrar: false };
  const limpio = String(valor).trim();
  if (!limpio || limpio.toLowerCase() === 'todas') return { filtrar: false };
  return { filtrar: true, sedeId: limpio };
}

/**
 * Traduce el parámetro `sede` a un filtro de Prisma, validando que la sede sea
 * de este gimnasio. Devuelve `{ where }`, `{}` o `{ error }`.
 *
 * **La matriz filtra igual que las demás.** Su privilegio es administrativo —
 * desde ella se manejan los permisos y la configuración—, pero produce como un
 * local más: cada sede lleva la cuenta de lo suyo, como una empresa con varias
 * plantas. El total de todas juntas es un dato del superadmin, no del admin.
 */
async function filtroSede(req) {
  const pedido = interpretarParametroSede(req.query.sede);
  if (!pedido.filtrar) return {};
  const sede = await sedeDelGym(req.gymId, pedido.sedeId);
  if (!sede) return { error: 'Sede no encontrada en este gimnasio' };
  return { where: { sedeId: sede.id } };
}

/**
 * Si quien consulta está parado en la casa matriz. Es lo que habilita
 * administrar permisos y configuración: desde un local común no se tocan.
 */
async function estaEnLaMatriz(req) {
  const pedido = interpretarParametroSede(req.query?.sede ?? req.body?.sede);
  if (!pedido.filtrar) return true;   // sin sede elegida no hay restricción
  const sede = await sedeDelGym(req.gymId, pedido.sedeId);
  return !sede || !!sede.esPrincipal;
}

/**
 * Por qué puerta se está registrando una entrada desde recepción.
 *
 * Para un **empleado** manda su propia sede y nada más: la recepcionista de
 * Norte está en Norte, no puede elegir otra y así no se equivoca de local.
 *
 * Para el **administrador** manda la sede que tenga elegida en la barra. El
 * admin también tiene una sede propia (le quedó asignada al crearse la
 * principal), pero él maneja todos los locales y se mueve entre ellos: si
 * ganara su sede propia, estando parado en Norte las entradas se le irían a
 * Principal. Si está en "Todas" la entrada queda sin sede, en vez de
 * inventarle una.
 *
 * Un gimnasio de un solo local devuelve null siempre, igual que antes de que
 * existieran las sedes.
 */
async function sedeParaRegistrar(req) {
  const quien = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { sedeId: true, role: true, sede: { select: { esPrincipal: true } } }
  });

  // Manda la sede propia: cada uno trabaja en su local. El administrador de una
  // sede da de alta en la suya y nada más, así que lo que cree no puede caer en
  // otra por tener el selector en otro lado.
  if (quien?.sedeId && !quien.sede?.esPrincipal) return quien.sedeId;

  // Sólo quien maneja la casa matriz puede estar parado en otro local (para
  // mirarlo) y dar de alta ahí; si no eligió ninguno, cae en el suyo.
  const pedido = interpretarParametroSede(req.body?.sede ?? req.query?.sede);
  if (pedido.filtrar) {
    const sede = await sedeDelGym(req.gymId, pedido.sedeId);
    if (sede) return sede.id;
  }
  return quien?.sedeId || null;
}

/**
 * Si quien pide puede MODIFICAR a esta persona.
 *
 * Cada sede se maneja aparte, con su propio administrador: desde otro local se
 * puede mirar, no tocar. Apagar los botones en la pantalla no alcanza — sin
 * esto, la misma petición mandada a mano pasaría igual.
 *
 * Deja pasar cuando no hay sedes (gimnasio de un solo local, todo como antes) o
 * cuando quien pide no tiene sede propia, para no romper cuentas viejas.
 */
async function puedeModificarA(req, usuarioId) {
  const [yo, objetivo] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.userId }, select: { sedeId: true } }),
    prisma.user.findFirst({ where: { id: String(usuarioId), gymId: req.gymId }, select: { sedeId: true } })
  ]);
  if (!objetivo) return { ok: false, motivo: 'Usuario no encontrado' };
  if (!yo?.sedeId) return { ok: true };
  if (!objetivo.sedeId) return { ok: true };
  if (objetivo.sedeId === yo.sedeId) return { ok: true };
  return { ok: false, motivo: 'Esa persona es de otra sede: podés consultarla, no modificarla' };
}

function validarNombre(nombre) {
  if (typeof nombre !== 'string') return null;
  const limpio = nombre.trim();
  if (!limpio.length || limpio.length > MAX_NOMBRE) return null;
  return limpio;
}

module.exports = {
  MAX_NOMBRE,
  sedeDelGym,
  interpretarParametroSede,
  filtroSede,
  estaEnLaMatriz,
  sedeParaRegistrar,
  puedeModificarA,
  validarNombre
};
