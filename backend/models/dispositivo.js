const mongoose = require('mongoose');

/**
 * Lector de huella / torniquete de control de acceso instalado en un gimnasio.
 *
 * Estos equipos empujan las marcaciones por HTTP y lo único que los identifica
 * es su número de serie, que viaja en la URL y a la vista. Por eso la serie se
 * registra ANTES desde el panel del admin: al llegar un registro, el `gymId`
 * sale de aquí y nunca de la petición, que es lo que impide que un equipo
 * ajeno escriba asistencias en el gimnasio equivocado.
 *
 * A propósito NO lleva el plugin de borrado suave: la serie es única a nivel
 * global (un aparato físico pertenece a un solo gimnasio) y un documento
 * borrado suavemente seguiría ocupando esa serie, impidiendo volver a darla de
 * alta si el equipo se traslada o se registra mal.
 */
const DispositivoSchema = new mongoose.Schema({
  gymId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gym',
    required: true,
    index: true
  },
  // Nombre libre para que el admin distinga sus equipos ("Torniquete entrada").
  nombre: {
    type: String,
    required: [true, 'El nombre del equipo es obligatorio'],
    trim: true,
    maxlength: 60
  },
  // Número de serie que el propio aparato envía en cada petición.
  serie: {
    type: String,
    required: [true, 'El número de serie es obligatorio'],
    trim: true,
    uppercase: true,
    unique: true,
    match: [/^[A-Z0-9-]{4,32}$/, 'La serie solo admite letras, números y guiones (4 a 32 caracteres)']
  },
  marca: {
    type: String,
    enum: ['zkteco', 'hikvision', 'suprema', 'anviz', 'otro'],
    default: 'zkteco'
  },
  // Un equipo desactivado se sigue viendo en el panel, pero sus marcaciones
  // se rechazan: sirve para dar de baja un lector sin perder su historial.
  activo: {
    type: Boolean,
    default: true
  },
  // Se actualiza en cada marcación recibida; es lo que permite mostrarle al
  // gimnasio "conectado hace 2 minutos" sin que tenga que llamar a soporte.
  ultimaConexion: {
    type: Date,
    default: null
  }
}, { timestamps: true });

DispositivoSchema.index({ gymId: 1, createdAt: -1 });

module.exports = mongoose.model('Dispositivo', DispositivoSchema);
