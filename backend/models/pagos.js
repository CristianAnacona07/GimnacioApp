const mongoose = require('mongoose');

const MetodoPagoSchema = new mongoose.Schema({
    gymId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Gym',
        required: true,
        index: true
    },
    titulo: { 
        type: String, 
        required: [true, 'El título es obligatorio'],
        trim: true 
    },
    tipo: { 
        type: String, 
        enum: ['digital', 'efectivo'], 
        default: 'digital' 
    },
    imagenUrl: { type: String },
    descripcion: { type: String },
    datosClave: {
        type: String
        // Aquí puedes poner el número de celular o la ubicación
    },
    activo: { 
        type: Boolean, 
        default: true
    }
}, {
    timestamps: true // Esto crea automáticamente campos 'createdAt' y 'updatedAt'
});

// Índice compuesto para optimizar consultas de métodos de pago por gimnasio
MetodoPagoSchema.index({ gymId: 1, createdAt: -1 });

module.exports = mongoose.model('MetodoPago', MetodoPagoSchema);