const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    nombre: { 
        type: String, 
        required: [true, 'El nombre es obligatorio'] 
    },
    email: { 
        type: String, 
        required: [true, 'El correo es obligatorio'],
        unique: true,
        lowercase: true 
    },
    password: { 
        type: String, 
        required: [true, 'La contraseña es obligatoria'] 
    },
  
    role: { 
        type: String, 
        enum: ['admin', 'entrenador', 'socio'], 
        default: 'socio' 
    },

    //perfil
    fotoUrl: { type: String, default: '' },
    mensajeMotivador: { type: String, default: 'HAZ QUE SUCEDA' },
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
        asistenciasMes: { type: Number, default: 0 } // Para el "124" de tu captura
    },
    //perfil

    fechaRegistro: { 
        type: Date, 
        default: Date.now 
    },
    fechaVencimiento: { 
        type: Date
     }
});

module.exports = mongoose.model('User', UserSchema);