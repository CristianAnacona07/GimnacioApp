const mongoose = require('mongoose');

const RutinaSchema = new mongoose.Schema({
    // Conectamos la rutina con un usuario específico
    usuarioId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    // Nombre de la rutina (ej: "Lunes - Pecho y Tríceps")
    nombre: { 
        type: String, 
        required: true 
    },
    // Lista de ejercicios para esta rutina
    ejercicios: [{
        nombre: { type: String, required: true },
        series: { type: Number, default: 0 },
        repeticiones: { type: String, default: '0' },
        instrucciones: { type: String }, // Aquí irá la descripción que quieres
        imagenUrl: { type: String },     // Aquí irá el link a la foto
        completado: { type: Boolean, default: false }
    }],
    fechaCreacion: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Rutina', RutinaSchema);