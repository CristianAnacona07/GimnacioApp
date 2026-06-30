const mongoose = require('mongoose');

const ProgresoSchema = new mongoose.Schema({
    gymId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Gym',
        required: false,
        index: true
    },
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

ProgresoSchema.index({ gymId: 1, usuarioId: 1, ejercicioNombre: 1 });
ProgresoSchema.index({ gymId: 1, usuarioId: 1, fecha: 1 });

module.exports = mongoose.model('Progreso', ProgresoSchema);
