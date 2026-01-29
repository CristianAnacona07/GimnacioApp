const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// 1. Middlewares
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

// 2. Ruta de Salud (Para UptimeRobot)
app.get('/health', (req, res) => {
  res.status(200).send('Servidor Despierto');
});

// 3. Conexión a MongoDB
const MONGO_URI = process.env.MONGO_URI;
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Conectado a MongoDB'))
    .catch(err => console.error('❌ Error de conexión:', err));

// 4. Rutas de tu API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rutinas', require('./routes/rutina'));
app.use('/api/noticias', require('./routes/noticia'));
app.use('/api/planes', require('./routes/planes'));
app.use('/api/pagos', require('./routes/pagos'));

// 5. Puerto y Arranque
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    iniciarKeepAlive(); // Activa el auto-ping
});

// 6. Función Keep-Alive (Evita que Render se duerma)
function iniciarKeepAlive() {
  const URL = 'https://gimnacioapp-backend-1.onrender.com/health'; 

  setInterval(async () => {
    try {
      await axios.get(URL);
      console.log('✅ Auto-ping enviado con éxito');
    } catch (error) {
      console.log('⚠️ Error en el auto-ping:', error.message);
    }
  }, 13 * 60 * 1000); // Cada 13 minutos
}