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
    fechaRegistro: { 
        type: Date, 
        default: Date.now 
    },
    fechaVencimiento: { 
        type: Date
     }
});

module.exports = mongoose.model('User', UserSchema);