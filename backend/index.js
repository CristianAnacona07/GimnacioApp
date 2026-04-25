const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const compression = require('compression');

require('dotenv').config();

const app = express();

// --- MIDDLEWARES ---
app.use(compression());
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = ['https://gimnacio-app.vercel.app'];
    const isLocalhost = !origin || /^http:\/\/localhost(:\d+)?$/.test(origin);
    if (isLocalhost || allowedOrigins.includes(origin) || origin?.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('CORS bloqueado por seguridad Drakkar'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'user-id'],
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// --- CONEXIÓN A MONGO (OPTIMIZADA PARA VERCEL) ---
let cachedDb = null;
const connectDB = async () => {
  if (cachedDb && mongoose.connection.readyState >= 1) return cachedDb;
  cachedDb = await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    family: 4
  });
  console.log('✅ Conectado a MongoDB');
  return cachedDb;
};

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch {
    res.status(500).json({ error: 'Error de conexión a la BD' });
  }
});

// --- RUTAS DE API ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rutinas', require('./routes/rutina'));
app.use('/api/noticias', require('./routes/noticia'));
app.use('/api/planes', require('./routes/planes'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api/progreso', require('./routes/progreso'));

app.get('/health', (req, res) => res.status(200).json({ status: 'viking_active' }));

// --- ADAPTACIÓN FINAL PARA VERCEL ---
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 10000;
  app.listen(PORT, () => console.log(`🚀 Volando en puerto ${PORT}`));
}

module.exports = app;
