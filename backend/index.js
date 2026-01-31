const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
const compression = require('compression');
const NodeCache = require('node-cache');
const Rutina = require('./models/rutina'); // Asegúrate de que la ruta sea correcta
require('dotenv').config();

const app = express();

// --- CONFIGURACIÓN DE CACHÉ ---
const cache = new NodeCache({ 
  stdTTL: 600,      // 10 minutos de vida por defecto
  checkperiod: 120  // Limpia expirados cada 2 minutos
});

// --- MIDDLEWARES ---
app.use(compression()); // Comprime respuestas para mayor velocidad
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
  allowedHeaders: ['Content-Type', 'Authorization', 'user-id'], // Añadido user-id para el caché
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '10mb'}));
app.use(express.urlencoded({limit: '10mb', extended: true }));

// --- LÓGICA DE CACHÉ INTELIGENTE ---
// Función para limpiar caché de un usuario específico tras un cambio (POST/PUT/DELETE)
const clearUserCache = (userId) => {
  if (!userId) return;
  const keys = cache.keys();
  const userKeys = keys.filter(key => key.includes(`cache_${userId}`));
  userKeys.forEach(key => cache.del(key));
  console.log(`🧹 Memoria liberada para el guerrero: ${userId}`);
};
app.set('clearUserCache', clearUserCache);

// Middleware para servir y guardar caché en peticiones GET
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.includes('health') || req.path.includes('keep-alive')) {
    return next();
  }

  // Usamos el ID del usuario o el email desde los headers para separar el caché
  const userIdentifier = req.headers['user-id'] || 'publico';
  const key = `cache_${userIdentifier}_${req.originalUrl}`;
  const cachedResponse = cache.get(key);

  if (cachedResponse) {
    console.log(`🎯 Drakkar Cache HIT: ${key}`);
    return res.json(cachedResponse);
  }

  // Interceptamos la respuesta para guardarla en caché si es exitosa
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (res.statusCode === 200) {
      cache.set(key, data); 
    }
    return originalJson(data);
  };
  next();
});

// --- RUTAS DE SISTEMA (Keep-Alive & Health) ---
app.get('/health', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping(); 
    res.status(200).json({ status: 'viking_active', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', details: err.message });
  }
});

app.get('/keep-alive', async (req, res) => {
  try {
    // Solo golpeamos la BD si no hay un ping reciente en caché
    if (!cache.get('db_warm')) {
      await Rutina.findOne().lean();
      cache.set('db_warm', true, 60);
    }
    res.status(200).json({ message: 'Drakkar Server Awake', timestamp: new Date() });
  } catch (error) {
    res.status(500).json({ error: 'DB_SLEEPING' });
  }
});

// --- CONEXIÓN A MONGO CON OPTIMIZACIÓN ---
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI, {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 8000, 
  socketTimeoutMS: 45000,
  family: 4 // Fuerza IPv4 para evitar lags de resolución DNS
})
.then(() => {
  console.log('✅ Conectado a MongoDB (Valhalla Mode)');
  crearIndices();
})
.catch(err => console.error('❌ Error de conexión:', err));

// --- RUTAS DE API ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rutinas', require('./routes/rutina'));
app.use('/api/noticias', require('./routes/noticia'));
app.use('/api/planes', require('./routes/planes'));
app.use('/api/pagos', require('./routes/pagos'));

// Ruta manual para limpiar todo el caché (Solo desarrollo)
app.post('/api/admin/clear-all-cache', (req, res) => {
  cache.flushAll();
  res.json({ message: 'Caché global reseteado' });
});

// --- TAREAS PROGRAMADAS Y PUERTO ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`🚀 Drakkar Gym volando en puerto ${PORT}`);
    iniciarLimpiezaDiaria();
});

function iniciarLimpiezaDiaria() {
  cron.schedule('0 0 * * *', async () => {
    try {
      await Rutina.updateMany({}, { $set: { "ejercicios.$[].completado": false } });
      cache.flushAll(); // Limpiamos caché al resetear el día
      console.log('🧹 Rutinas diarias reseteadas exitosamente');
    } catch (error) {
      console.error('❌ Error en limpieza:', error.message);
    }
  }, { timezone: "America/Bogota" });
}

async function crearIndices() {
  try {
    // Índices cruciales para velocidad de búsqueda
    await Rutina.collection.createIndex({ usuarioId: 1 });
    console.log('✅ Índices de rendimiento creados');
  } catch (error) {
    console.log('⚠️ Aviso de índices:', error.message);
  }
}