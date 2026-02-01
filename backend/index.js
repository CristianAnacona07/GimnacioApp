const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
const compression = require('compression');
const Rutina = require('./models/rutina'); 

require('dotenv').config();

const app = express();


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
        console.log(`🚀 volando en puerto ${PORT}`);
    });
}

// Vercel necesita que exportemos la app
module.exports = app;