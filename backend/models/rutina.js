const mongoose = require('mongoose');
const RutinaSchema = new mongoose.Schema({
    usuarioId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    // Lo hacemos opcional por si tienes datos viejos, 
    // pero ya no será necesario para las nuevas rutinas.
    nombre: { 
        type: String, 
        required: false 
    },
    dia: { 
        type: String, 
        required: true,
        enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] 
    },
    enfoque: { 
        type: String, 
        required: true,
        trim: true 
    },
    ejercicios: [{
        nombre: { type: String, required: true },
        series: { type: Number, default: 0 },
        repeticiones: { type: String, default: '0' },
        instrucciones: { type: String },
        imagenUrl: { type: String },
        completado: { type: Boolean, default: false }
    }],
    fechaCreacion: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Rutina', RutinaSchema);