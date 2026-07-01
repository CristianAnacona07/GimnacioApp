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

const app = express();
app.set('trust proxy', 1); // detrás del proxy de Vercel: necesario para rate-limit por IP

// --- MIDDLEWARES ---
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: function (origin, callback) {
    // Allowlist explicita (sin comodin *.vercel.app, que dejaria entrar a cualquiera).
    const allowedOrigins = [
      'https://gimnacio-app.vercel.app',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    const isLocalhost = !origin || /^https?:\/\/localhost(:\d+)?$/.test(origin);
    // Apps nativas con Capacitor (Android usa https://localhost; iOS, capacitor://localhost)
    const isApp = origin === 'capacitor://localhost' || origin === 'ionic://localhost';
    if (isLocalhost || isApp || allowedOrigins.includes(origin)) {
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

const connectDB = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;

  cachedDb = await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 5,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10000,  // 10s para cold start
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    heartbeatFrequencyMS: 10000,
    family: 4
  });

  console.log('✅ Conectado a MongoDB');
  return cachedDb;
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

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => console.log(`🚀 Puerto ${PORT}`));
}

module.exports = app;
