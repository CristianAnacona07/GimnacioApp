const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');
const cron = require('node-cron');
const Rutina = require('./models/rutina');
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
app.get('/health', async (req, res) => {
  try {
    // Esto obliga a MongoDB a reaccionar
    await mongoose.connection.db.admin().ping(); 
    res.status(200).send('Servidor y Base de Datos Despiertos');
  } catch (err) {
    res.status(500).send('Error al despertar DB');
  }
});

// Agregar esta ruta DESPUÉS del /health
app.get('/keep-alive', async (req, res) => {
  try {
    // Consulta rápida a la BD para asegurar que está despierta
    await Rutina.countDocuments().lean();
    
    console.log('✅ Keep-Alive: Todo funciona correctamente');
    res.status(200).json({
      status: 'success',
      message: 'Servidor y BD despiertos',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error en keep-alive:', error.message);
    res.status(500).json({ 
      status: 'error', 
      message: 'Error al verificar BD'
    });
  }
});


// 3. Conexión a MongoDB
const MONGO_URI = process.env.MONGO_URI;
// 3. Conexión a MongoDB con Timeouts
mongoose.connect(MONGO_URI, {
  serverSelectionTimeoutMS: 5000, // Máximo 5 segundos para encontrar el servidor de BD
  socketTimeoutMS: 45000,         // Cierra conexiones inactivas para liberar memoria
})
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
    iniciarLimpiezaDiaria(); // Activa la tarea programada
});

// 6. Función Keep-Alive (Evita que Render se duerma)
function iniciarKeepAlive() {
  const URL = 'https://gimnacioapp-backend-1.onrender.com/keep-alive';

  setInterval(async () => {
    try {
      const response = await axios.get(URL);
      console.log('✅ Auto-ping:', response.data.message);
    } catch (error) {
      console.log('⚠️ Error en auto-ping:', error.message);
    }
  }, 10 * 60 * 1000); // Cada 10 minutos (más frecuente)
}

// 7. Tarea Programada: Reinicio a Medianoche
function iniciarLimpiezaDiaria() {
  // Se ejecuta a las 00:00 (medianoche)
  cron.schedule('0 0 * * *', async () => {
    try {
      // Esta línea busca todas las rutinas y resetea el campo 'completado' 
      // de todos los ejercicios dentro del array.
      await Rutina.updateMany(
        {}, 
        { $set: { "ejercicios.$[].completado": false } }
      );
      console.log('🧹 Limpieza completada: Rutinas reseteadas para el nuevo día');
    } catch (error) {
      console.log('❌ Error en limpieza diaria:', error.message);
    }
  }, {
    timezone: "America/Bogota" // Ajustado a tu zona horaria
  });
 

}