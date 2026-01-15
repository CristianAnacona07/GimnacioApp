const mongoose = require('mongoose');

const MetodoPagoSchema = new mongoose.Schema({
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
    imagenUrl: { 
        type: String, 
        required: [false, 'La URL de la imagen o icono es obligatoria'] 
    },
    descripcion: { 
        type: String, 
        required: [false, 'La descripción es obligatoria'] 
    },
    datosClave: { 
        type: String, 
        help: 'Aquí puedes poner el número de celular o la ubicación'
    },
    activo: { 
        type: Boolean, 
        default: true
    }
}, { 
    timestamps: true // Esto crea automáticamente campos 'createdAt' y 'updatedAt'
});

module.exports = mongoose.model('MetodoPago', MetodoPagoSchema);