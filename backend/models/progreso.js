const mongoose = require('mongoose');

const ProgresoSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ejercicioNombre: {
        type: String,
        required: true,
        trim: true
    },
    pesoKg: {
        type: Number,
        default: null
    },
    repeticiones: {
        type: Number,
        default: null
    },
    fecha: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('Progreso', ProgresoSchema);
