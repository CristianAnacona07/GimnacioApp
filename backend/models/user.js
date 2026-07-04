const mongoose = require('mongoose');
const softDelete = require('./plugins/softDelete');

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
        lowercase: true,
        trim: true
        // Unicidad por gym definida abajo con índice compuesto.
    },
    password: {
        type: String,
        required: [true, 'La contraseña es obligatoria'],
        select: false      // nunca se devuelve salvo .select('+password') explícito
    },
  
    role: {
        type: String,
        enum: ['superadmin', 'admin', 'entrenador', 'socio'],
        default: 'socio'
    },

    // Entrenador asignado a un socio (opcional). Permite que un entrenador
    // gestione sólo a los socios que le corresponden dentro de su gym.
    entrenadorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
        index: true
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
    },

    // Verificación de correo (el registro envía un enlace; no bloquea el login
    // para no dejar fuera a usuarios previos, pero expone el estado verificado).
    emailVerified: { type: Boolean, default: false },
    verifyToken: { type: String, default: null, select: false },
    verifyTokenExpiry: { type: Date, default: null, select: false },

    // Doble factor (TOTP) opcional. El secreto nunca se devuelve por defecto.
    twoFactor: {
        enabled: { type: Boolean, default: false },
        secret: { type: String, default: null, select: false },
        backupCodes: { type: [String], default: [], select: false }
    }
}, {
    timestamps: true  // ⚡ Agrega createdAt y updatedAt automáticamente
});

// Borrado lógico: deletedAt + exclusión automática en las lecturas.
UserSchema.plugin(softDelete);

// Email único POR gimnasio (multi-gym): el mismo correo puede existir en
// gimnasios distintos, pero no dos veces dentro del mismo gym.
UserSchema.index({ email: 1, gymId: 1 }, { unique: true });

module.exports = mongoose.model('User', UserSchema);