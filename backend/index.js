const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json()); // Para que el servidor entienda formato JSON

// Conexión a MongoDB (Usa la URL de tu Compass)
const MONGO_URI = 'mongodb+srv://cristianfelipe07_db:Realmadrid07.@cluster0.h6u3dpl.mongodb.net/gymDB?retryWrites=true&w=majority';

// Conexión a MongoDB
const rutinaRoutes = require('./routes/rutina');

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ Conectado a MongoDB Compass'))
    .catch(err => console.error('❌ Error de conexión:', err));

const PORT = 3000;
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rutinas', require('./routes/rutina'));

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});