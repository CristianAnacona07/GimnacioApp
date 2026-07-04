const mongoose = require('mongoose');

const TransaccionSchema = new mongoose.Schema({
    gymId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Gym',
        required: true,
        index: true
    },
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    monto: {
        type: Number,
        required: true,
        min: 0
    },
    metodoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MetodoPago'
    },
    concepto: {
        type: String,
        default: 'Membresía'
    },
    diasAgregados: {
        type: Number,
        default: 0
    },
    fecha: {
        type: Date,
        default: Date.now
    },
    registradoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

TransaccionSchema.plugin(require('./plugins/softDelete'));

TransaccionSchema.index({ gymId: 1, createdAt: -1 });

module.exports = mongoose.model('Transaccion', TransaccionSchema);
