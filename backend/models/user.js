const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    gymId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Gym',
        required: false,
        index: true
    },
    nombre: {
        type: String,
        required: [true, 'El nombre es obligatorio']
    },
    email: { 
        type: String, 
        required: [true, 'El correo es obligatorio'],
        unique: true,      // ⚡ Esto ya crea el índice automáticamente
        lowercase: true,
        trim: true
    },
    password: { 
        type: String, 
        required: [true, 'La contraseña es obligatoria'] 
    },
  
    role: {
        type: String,
        enum: ['superadmin', 'admin', 'entrenador', 'socio'],
        default: 'socio'
    },

    // Perfil
    fotoUrl: { 
        type: String, 
        default: '' 
    },
    mensajeMotivador: { 
        type: String, 
        default: 'HAZ QUE SUCEDA' 
    },
    datosPersonales: {
        identificacion: { type: String, default: '' },
        fechaNacimiento: { type: String, default: '' },
        sexo: { type: String, default: '' },
        pesoActual: { type: Number, default: 0 },
        altura: { type: Number, default: 0 },
        telefono: { type: String, default: '' }
    },

    stats: {
        racha: { type: Number, default: 0 },
        asistenciasMes: { type: Number, default: 0 }
    },

    fechaRegistro: { 
        type: Date, 
        default: Date.now 
    },
    fechaVencimiento: {
        type: Date
    },
    resetToken: {
        type: String,
        default: null
    },
    resetTokenExpiry: {
        type: Date,
        default: null
    }
}, {
    timestamps: true  // ⚡ Agrega createdAt y updatedAt automáticamente
});

// ❌ REMOVIDO: UserSchema.index({ email: 1 }, { unique: true });
// No es necesario porque ya está definido arriba con unique: true

module.exports = mongoose.model('User', UserSchema);