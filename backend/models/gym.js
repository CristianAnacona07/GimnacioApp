const mongoose = require('mongoose');

const GymSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del gimnasio es obligatorio'],
    trim: true
  },
  slug: {
    type: String,
    required: [true, 'El código único es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[a-z0-9-]+$/, 'El slug solo puede tener letras minúsculas, números y guiones']
  },
  logo: {
    type: String,
    default: null
  },
  slogan: {
    type: String,
    default: ''
  },
  colores: {
    primario:   { type: String, default: '#f97316' },
    secundario: { type: String, default: '#1d4ed8' },
    fondo:      { type: String, default: '#eef3ff' },
    navbar:     { type: String, default: '#0f172a' },
    menu:       { type: String, default: '#1e293b' },
    dias:       { type: String, default: '#1d4ed8' }
  },
  modulos: {
    rutinas:    { type: Boolean, default: true },
    progreso:   { type: Boolean, default: true },
    medidas:    { type: Boolean, default: true },
    pagos:      { type: Boolean, default: true },
    noticias:   { type: Boolean, default: true },
    cronometro: { type: Boolean, default: true }
  },
  activo: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

GymSchema.index({ nombre: 'text' });

module.exports = mongoose.model('Gym', GymSchema);
