require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const User     = require('../models/user');

const EMAIL    = 'anaconac748@gmail.com';  // tu email
const PASSWORD = 'KodiakSuper2026!';       // cambialo después de crear la cuenta

async function crear() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Conectado');

  const existe = await User.findOne({ email: EMAIL });
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
