const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

/**
 * Canal en tiempo real (WebSocket).
 *
 * Sustituye a las consultas repetidas del frontend: en vez de preguntar cada
 * pocos minutos si algo cambió, el servidor avisa en el momento.
 *
 * Aislamiento: al conectarse, cada cliente entra en la sala de SU gimnasio y en
 * la suya propia. Los avisos se mandan a una sala, nunca a todos — es el mismo
 * principio del gymId en las consultas, aplicado a los mensajes.
 *
 * Solo se activa donde hay un servidor que vive entre peticiones (el contenedor
 * o el VPS). Si no se inicializa, `emitir*` no hace nada y la app sigue
 * funcionando con sus consultas periódicas de siempre.
 */

let io = null;

const salaGym = (gymId) => `gym:${gymId}`;
const salaUsuario = (usuarioId) => `usuario:${usuarioId}`;

/** Mismo criterio de orígenes permitidos que el CORS de la API. */
function origenPermitido(origin) {
  if (!origin) return true;
  const permitidos = ['https://gimnacio-app.vercel.app', process.env.FRONTEND_URL].filter(Boolean);
  if (permitidos.includes(origin)) return true;
  if (/^https?:\/\/([a-z0-9-]+\.)?localhost(:\d+)?$/i.test(origin)) return true;
  if (origin === 'capacitor://localhost' || origin === 'ionic://localhost') return true;
  const raiz = process.env.TENANT_ROOT_DOMAIN;
  if (raiz && new RegExp(`^https://([a-z0-9-]+\\.)?${raiz.replace(/\./g, '\\.')}$`, 'i').test(origin)) return true;
  return false;
}

/** Arranca el canal sobre el servidor HTTP ya existente. */
function iniciar(servidorHttp) {
  io = new Server(servidorHttp, {
    cors: {
      origin: (origin, cb) => cb(null, origenPermitido(origin)),
      credentials: true
    },
    // Si el navegador o la red no admiten WebSocket, socket.io cae solo a
    // consultas largas; la app no se entera.
    transports: ['websocket', 'polling']
  });

  // La sesión se valida con el MISMO token de la API: el cliente lo manda al
  // conectar y aquí se verifica. Un socket sin token válido no entra.
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Sin token'));
      const datos = jwt.verify(token, JWT_SECRET);
      socket.data.usuarioId = datos.id;
      socket.data.gymId = datos.gymId || null;
      socket.data.rol = datos.role;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(salaUsuario(socket.data.usuarioId));
    if (socket.data.gymId) socket.join(salaGym(socket.data.gymId));
  });

  console.log('🔌 Canal en tiempo real activo');
  return io;
}

/** Avisa a todo un gimnasio (recepción, avisos del admin…). */
function emitirAGym(gymId, evento, datos = {}) {
  if (io && gymId) io.to(salaGym(gymId)).emit(evento, datos);
}

/** Avisa a una sola persona, en todos los dispositivos donde tenga la app abierta. */
function emitirAUsuario(usuarioId, evento, datos = {}) {
  if (io && usuarioId) io.to(salaUsuario(usuarioId)).emit(evento, datos);
}

module.exports = { iniciar, emitirAGym, emitirAUsuario };
