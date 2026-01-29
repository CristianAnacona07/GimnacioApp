const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios'); // Movido arriba con las demás importaciones
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

app.use(express.json({ limit: '10mb'}));
app.use(express.urlencoded({limit: '10mb', extended: true }));

// --- NUEVA RUTA DE SALUD (Poner antes de las otras rutas) ---
app.get('/health', (req, res) => {
  res.send('Estoy despierto');
});

// Conexión a MongoDB
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Conectado a MongoDB'))
    .catch(err => console.error('❌ Error de conexión:', err));

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rutinas', require('./routes/rutina'));
app.use('/api/noticias', require('./routes/noticia'));
app.use('/api/planes', require('./routes/planes'));
app.use('/api/pagos', require('./routes/pagos'));

// Puerto dinámico y arranque del servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    
    // Iniciar el auto-ping cuando el servidor arranque
    iniciarKeepAlive();
});

// --- FUNCIÓN KEEP ALIVE ---
function iniciarKeepAlive() {
  // AQUÍ CAMBIÉ TU URL POR LA REAL DE TU CAPTURA
  const URL_DE_MI_APP = 'https://gimnacioapp-backend-1.onrender.com/health'; 

  setInterval(async () => {
    try {
      await axios.get(URL_DE_MI_APP);
      console.log('✅ Auto-ping enviado con éxito');
    } catch (error) {
      console.log('⚠️ Error en el auto-ping:', error.message);
    }
  }, 13 * 60 * 1000); // 13 minutos
}