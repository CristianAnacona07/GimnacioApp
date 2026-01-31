const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
const compression = require('compression');
const NodeCache = require('node-cache');
const Rutina = require('./models/rutina'); 

require('dotenv').config();

const app = express();

// --- CONFIGURACIÓN DE CACHÉ ---
const cache = new NodeCache({ 
  stdTTL: 600,      
  checkperiod: 120  
});

// --- MIDDLEWARES ---
app.use(compression()); 
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://gimnacio-app.vercel.app',
      'http://localhost:3000',
      'http://localhost:4200'
    ];
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
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

app.use(express.json({ limit: '10mb'}));
app.use(express.urlencoded({limit: '10mb', extended: true }));

// --- LÓGICA DE CACHÉ INTELIGENTE ---
const clearUserCache = (userId) => {
  if (!userId) return;
  const keys = cache.keys();
  const userKeys = keys.filter(key => key.includes(`cache_${userId}`));
  userKeys.forEach(key => cache.del(key));
};
app.set('clearUserCache', clearUserCache);

app.use((req, res, next) => {
  const excludedPaths = ['/health', '/keep-alive', '/api/auth/login', '/api/auth/register'];
  if (req.method !== 'GET' || excludedPaths.some(path => req.path.includes(path))) {
    return next();
  }
  const userIdentifier = req.headers['user-id'] || 'publico';
  const key = `cache_${userIdentifier}_${req.originalUrl}`;
  const cachedResponse = cache.get(key);
  if (cachedResponse) return res.json(cachedResponse);

  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (res.statusCode === 200) cache.set(key, data); 
    return originalJson(data);
  };
  next();
});

// --- CONEXIÓN A MONGO (OPTIMIZADA PARA VERCEL) ---
let cachedDb = null;
const connectDB = async () => {
  if (cachedDb && mongoose.connection.readyState >= 1) return cachedDb;
  
  // Optimizaciones de conexión para evitar lags en Serverless
  cachedDb = await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    family: 4 
  });
  console.log('✅ Conectado a MongoDB (Valhalla Mode)');
  return cachedDb;
};

// Middleware para asegurar conexión antes de cada ruta
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({ error: "Error de conexión a la BD" });
  }
});

// --- RUTAS DE API ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rutinas', require('./routes/rutina'));
app.use('/api/noticias', require('./routes/noticia'));
app.use('/api/planes', require('./routes/planes'));
app.use('/api/pagos', require('./routes/pagos'));

app.get('/health', (req, res) => res.status(200).json({ status: 'viking_active' }));

// --- ADAPTACIÓN FINAL PARA VERCEL ---
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 10000;
    app.listen(PORT, () => {
        console.log(`🚀 Drakkar Gym volando en puerto ${PORT}`);
    });
}

// Vercel necesita que exportemos la app
module.exports = app;