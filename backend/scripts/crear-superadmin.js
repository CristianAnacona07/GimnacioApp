require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/user');

// Credenciales por variables de entorno (no hardcodear secretos en el repo).
// Uso: SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node scripts/crear-superadmin.js
const EMAIL    = (process.env.SUPERADMIN_EMAIL || '').toLowerCase().trim();
const PASSWORD = process.env.SUPERADMIN_PASSWORD || '';

async function crear() {
  if (!EMAIL || !PASSWORD) {
    console.error('❌ Define SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD como variables de entorno.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Conectado');

  // El índice único es {email, gymId}; el superadmin vive con gymId null.
  const existe = await User.findOne({ email: EMAIL, gymId: null });
  if (existe) {
    if (existe.role !== 'superadmin') {
      existe.role = 'superadmin';
      existe.gymId = undefined;
      await existe.save();
      console.log('✅ Rol actualizado a superadmin:', EMAIL);
    } else {
      console.log('ℹ️  Ya es superadmin:', EMAIL);
    }
    await mongoose.disconnect();
    return;
  }

  const salt = await bcrypt.genSalt(10);
  await User.create({
    nombre:   'Super Admin',
    email:    EMAIL,
    password: await bcrypt.hash(PASSWORD, salt),
    role:     'superadmin',
    gymId:    null
  });

  console.log('✅ Superadmin creado:', EMAIL);
  console.log('🔑 Contraseña temporal:', PASSWORD);
  console.log('⚠️  Cambiala desde la app lo antes posible.');
  await mongoose.disconnect();
}

crear().catch(err => { console.error('❌', err.message); process.exit(1); });
