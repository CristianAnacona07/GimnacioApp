const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors({
  origin: [
    'https://gimnacio-app.vercel.app',
    'https://gimnacio-app-git-main-cristianfelipe07-5614s-projects.vercel.app',
    'http://localhost:3000',
    'http://localhost:4200',
    
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));
app.use(express.json()); // Para que el servidor entienda formato JSON

// Conexión a MongoDB (Usa la URL de tu Compass)
const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Conectado a MongoDB Compass'))
    .catch(err => console.error('❌ Error de conexión:', err));

    // Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rutinas', require('./routes/rutina'));
app.use('/api/noticias', require('./routes/noticia'));

// Puerto dinamico
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});



