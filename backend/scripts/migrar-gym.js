require('dotenv').config();
const mongoose = require('mongoose');
const Gym   = require('../models/gym');
const User  = require('../models/user');
const Rutina   = require('../models/rutina');
const Progreso = require('../models/progreso');
const Medidas  = require('../models/medidas');
const Noticia  = require('../models/noticia');
const MetodoPago = require('../models/pagos');
const Plan     = require('../models/planes');

async function migrar() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Conectado a MongoDB');

  // 1 — Crear el gym Kodiak si no existe
  let gym = await Gym.findOne({ slug: 'kodiak' });
  if (!gym) {
    gym = await Gym.create({
      nombre:    'Kodiak Gym',
      slug:      'kodiak',
      slogan:    'Strength · Discipline · Power',
      colores: {
        primario:   '#f97316',
        secundario: '#1d4ed8',
        fondo:      '#eef3ff',
        navbar:     '#0f172a'
      },
      modulos: {
        rutinas: true, progreso: true, medidas: true,
        pagos: true, noticias: true, cronometro: true
      },
      activo: true
    });
    console.log('✅ Gym creado:', gym.nombre, '— ID:', gym._id);
  } else {
    console.log('ℹ️  Gym ya existe:', gym.nombre, '— ID:', gym._id);
  }

  const id = gym._id;

  // 2 — Migrar colecciones
  const colecciones = [
    { model: User,       nombre: 'usuarios'   },
    { model: Rutina,     nombre: 'rutinas'    },
    { model: Progreso,   nombre: 'progreso'   },
    { model: Medidas,    nombre: 'medidas'    },
    { model: Noticia,    nombre: 'noticias'   },
    { model: MetodoPago, nombre: 'pagos'      },
    { model: Plan,       nombre: 'planes'     },
  ];

  for (const { model, nombre } of colecciones) {
    const res = await model.updateMany(
      { gymId: { $exists: false } },      // solo los que aún no tienen gymId
      { $set: { gymId: id } }
    );
    console.log(`✅ ${nombre}: ${res.modifiedCount} documentos migrados`);
  }

  console.log('\n🎉 Migración completada. Todos los datos quedan bajo Kodiak Gym.');
  await mongoose.disconnect();
}

migrar().catch(err => { console.error('❌', err.message); process.exit(1); });
