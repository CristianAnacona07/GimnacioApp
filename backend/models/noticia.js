const mongoose = require('mongoose');

const noticiaSchema = new mongoose.Schema({
  gymId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Gym',
    required: false,
    index: true
  },
  titulo: {
    type: String,
    required: true
  },
  descripcion: {
    type: String,
    required: true
  },
  dia: {
    type: String,
    required: false,
    enum: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
  },
  horaInicio: {
    type: String,
    required: false
  },
  horaFin: {
    type: String,
    required: false
  },
  imageUrl: {
    type: String,
    default: ''
  },
  whatsappUrl: {
    type: String,
    default: ''
  },
  estado: {
    type: Boolean,
    default: true
  }
}, { timestamps: true }); // createdAt + updatedAt automáticos (consistente con los demás modelos)

module.exports = mongoose.model('Noticia', noticiaSchema);