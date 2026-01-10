const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors({
  origin: [
    'https://gimnacio-app.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // Para que el servidor entienda formato JSON

// Conexión a MongoDB (Usa la URL de tu Compass)
const MONGO_URI = process.env.MONGO_URI;

// Conexión a MongoDB
const rutinaRoutes = require('./routes/rutina');

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Conectado a MongoDB Compass'))
    .catch(err => console.error('❌ Error de conexión:', err));

    // Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rutinas', require('./routes/rutina'));

// Puerto dinamico
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});