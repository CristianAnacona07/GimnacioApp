const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

require('dotenv').config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET no está definido. Configura las variables de entorno antes de arrancar.');
}

if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI no está definido. Configura las variables de entorno antes de arrancar.');
}

const app = express();
app.set('trust proxy', 1); // detrás del proxy de Vercel: necesario para rate-limit por IP

// --- MIDDLEWARES ---
// COOP 'same-origin-allow-popups' permite el flujo de login por popup de Google
// (el default 'same-origin' bloquea window.closed y rompe el Sign-In).
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
}));
app.use(compression());
app.use(cors({
  origin: function (origin, callback) {
    // Allowlist explicita (sin comodin *.vercel.app, que dejaria entrar a cualquiera).
    const allowedOrigins = [
      'https://gimnacio-app.vercel.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    // Subdominios de localhost (<slug>.localhost) permiten probar multi-tenant en dev
    const isLocalhost = !origin || /^https?:\/\/([a-z0-9-]+\.)?localhost(:\d+)?$/i.test(origin);
    // Apps nativas con Capacitor (Android usa https://localhost; iOS, capacitor://localhost)
    const isApp = origin === 'capacitor://localhost' || origin === 'ionic://localhost';
    // Multi-tenant por subdominio: TENANT_ROOT_DOMAIN=gimnasios.co permite
    // https://gimnasios.co y https://<slug>.gimnasios.co (solo un nivel, solo https)
    const raizTenant = process.env.TENANT_ROOT_DOMAIN;
    const isTenant = !!(raizTenant && origin && new RegExp(
      `^https://([a-z0-9-]+\\.)?${raizTenant.replace(/\./g, '\\.')}$`, 'i'
    ).test(origin));
    if (isLocalhost || isApp || isTenant || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS bloqueado por seguridad Kodiak'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// --- CONEXIÓN A MONGO OPTIMIZADA PARA VERCEL SERVERLESS ---
let cachedDb = null;
let connectingPromise = null;

const connectDB = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;

  // Lock por promesa: si dos requests llegan durante un cold start, comparten
  // el mismo intento de conexión en vez de abrir varias conexiones en paralelo.
  if (connectingPromise) return connectingPromise;

  connectingPromise = mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 5,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10000,  // 10s para cold start
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000,
    family: 4
  })
    .then((conn) => {
      cachedDb = conn;
      console.log('✅ Conectado a MongoDB');
      return cachedDb;
    })
    .catch((err) => {
      // Permite reintentar en la siguiente request si el intento falló.
      connectingPromise = null;
      throw err;
    });

  return connectingPromise;
};

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('❌ DB error:', err.message);
    res.status(500).json({ error: 'Error de conexión a la BD' });
  }
});

// --- RATE LIMITING en endpoints sensibles de auth (fuerza bruta / spam) ---
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,                  // 30 intentos por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos. Intenta de nuevo más tarde.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/google', authLimiter);
app.use('/api/2fa/verify', authLimiter);

// Límite general para el resto de la API (anti-abuso/DoS); más holgado que el de auth.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' }
});
app.use('/api', apiLimiter);

// --- RUTAS DE API ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rutinas', require('./routes/rutina'));
app.use('/api/noticias', require('./routes/noticia'));
app.use('/api/planes', require('./routes/planes'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/progreso', require('./routes/progreso'));
app.use('/api/medidas', require('./routes/medidas'));
app.use('/api/gym', require('./routes/gym'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/transacciones', require('./routes/transacciones'));
app.use('/api/entrenador', require('./routes/entrenador'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/2fa', require('./routes/twofa'));
app.use('/api/asistencia', require('./routes/asistencia'));

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

// --- 404: cualquier ruta no definida responde de inmediato (evita requests colgadas en serverless) ---
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// --- MANEJADOR DE ERRORES GLOBAL (Express 5 captura rechazos async de los handlers) ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('❌ Error no controlado:', err.message);
  if (err && err.message === 'CORS bloqueado por seguridad Kodiak') {
    return res.status(403).json({ error: 'Origen no permitido' });
  }
  res.status(err.status || 500).json({ error: 'Error interno del servidor' });
});

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => console.log(`🚀 Puerto ${PORT}`));
}

module.exports = app;
