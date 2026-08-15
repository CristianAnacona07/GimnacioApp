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
  },
  // ID de la playlist de Spotify del gimnasio (para el reproductor embebido).
  // Vacío = usa la playlist por defecto ("Beast Mode").
  spotifyPlaylist: {
    type: String,
    default: ''
  },

  // Sesiones personalizadas: el gimnasio fija cuánto duran y cuánto cuestan.
  // El horario lo pone cada profesional (User.disponibilidad).
  agenda: {
    activa: { type: Boolean, default: false },
    duracionMin: { type: Number, default: 60, min: 15 },
    precio: { type: Number, default: 0 },
    // Con cuánta antelación hay que reservar y cancelar, en horas. Evita que
    // alguien reserve para dentro de cinco minutos o cancele sobre la hora.
    horasMinimasReserva: { type: Number, default: 2 },
    horasMinimasCancelacion: { type: Number, default: 4 },
    // Hasta cuántos días hacia adelante se puede reservar.
    diasVisibles: { type: Number, default: 14 }
  },

  // Página pública del gimnasio (la que ve alguien sin cuenta, antes de entrar).
  // Cada bloque se prende o apaga por separado desde el admin; los textos vacíos
  // caen a un valor por defecto al pintarlos, para que nunca se vea un hueco.
  landing: {
    activa: { type: Boolean, default: false },

    portada: {
      imagen:     { type: String, default: '' },
      titulo:     { type: String, default: '' },   // vacío → el nombre del gym
      subtitulo:  { type: String, default: '' },   // vacío → el slogan
      textoBoton: { type: String, default: '' }    // vacío → "Quiero inscribirme"
    },

    sobreNosotros: {
      activo: { type: Boolean, default: true },
      titulo: { type: String, default: '' },
      texto:  { type: String, default: '' },
      imagen: { type: String, default: '' }
    },

    galeria: {
      activo: { type: Boolean, default: true },
      titulo: { type: String, default: '' },
      fotos:  [{ _id: false, url: String, descripcion: String }]
    },

    horarios: {
      activo: { type: Boolean, default: true },
      titulo: { type: String, default: '' },
      // Una fila por franja: { dias: 'Lunes a viernes', horas: '5:00 - 22:00' }
      filas:  [{ _id: false, dias: String, horas: String }]
    },

    // Estos dos no guardan contenido: muestran los planes y las noticias que el
    // gimnasio ya administra dentro de la app.
    planes:   { activo: { type: Boolean, default: true }, titulo: { type: String, default: '' } },
    noticias: { activo: { type: Boolean, default: true }, titulo: { type: String, default: '' } },

    contacto: {
      activo:    { type: Boolean, default: true },
      direccion: { type: String, default: '' },
      telefono:  { type: String, default: '' },
      whatsapp:  { type: String, default: '' },
      email:     { type: String, default: '' },
      instagram: { type: String, default: '' },
      facebook:  { type: String, default: '' },
      mapaUrl:   { type: String, default: '' }
    }
  }
}, { timestamps: true });

GymSchema.index({ nombre: 'text' });

GymSchema.plugin(require('./plugins/softDelete'));

module.exports = mongoose.model('Gym', GymSchema);
