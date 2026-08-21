/**
 * Migración de datos, una sola vez: MongoDB (Atlas) -> Postgres.
 *
 * Reemplaza a scripts/migrar-gym.js (retirado): ese script hacía un backfill
 * de gymId sobre datos ya en Mongo; este hace la migración completa a la
 * nueva base de datos.
 *
 * Uso:
 *   node scripts/etl-mongo-to-postgres.js                       # dry-run: solo cuenta, no escribe nada
 *   CONFIRMAR_MIGRACION=si node scripts/etl-mongo-to-postgres.js # ejecución real
 *   ... --force     # permite correr aunque Postgres ya tenga filas (por defecto aborta)
 *   ... --strict    # aborta ante cualquier fila con un campo NOT NULL vacío en Mongo, en vez de coaccionarlo
 *
 * Requiere MONGO_URI (origen) y DATABASE_URL (destino) en el entorno.
 *
 * Usa un PrismaClient BASE (sin las extensiones de softDelete/objectId): esta
 * migración escribe filas históricas tal cual —incluidas las ya borradas en
 * Mongo— y reutiliza los ObjectId de Mongo como id, así que no debe pasar por
 * los hooks pensados para el tráfico normal de la app.
 */

require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');
const { PrismaClient, Prisma } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const DRY_RUN = process.env.CONFIRMAR_MIGRACION !== 'si';
const FORCE = process.argv.includes('--force');
const STRICT = process.argv.includes('--strict');
const LOTE = 1000;

const hex = (v) => (v == null ? null : v.toHexString ? v.toHexString() : String(v));
const decimal = (v) => (v == null ? null : new Prisma.Decimal(v));

// Los días llegan de Mongo con tilde ("Miércoles", "Sábado"), pero el enum de
// Postgres no las admite en sus identificadores y los define sin ellas. Se
// quitan aquí para que coincidan; cualquier otro valor pasa tal cual y, si no
// existe en el enum, la base lo rechaza (que es lo que queremos).
const dia = (v) => (v == null ? null : String(v)
  .replace('é', 'e')   // Miércoles -> Miercoles
  .replace('á', 'a')); // Sábado    -> Sabado

function log(...args) {
  console.log(...args);
}

// ── Transforms por colección ────────────────────────────────────────────────

function tGym(d) {
  const colores = d.colores || {};
  const modulos = d.modulos || {};
  const agenda = d.agenda || {};
  return {
    id: hex(d._id),
    nombre: d.nombre,
    slug: (d.slug || '').toLowerCase(),
    logo: d.logo ?? null,
    slogan: d.slogan ?? '',
    colorPrimario: colores.primario ?? '#f97316',
    colorSecundario: colores.secundario ?? '#1d4ed8',
    colorFondo: colores.fondo ?? '#eef3ff',
    colorNavbar: colores.navbar ?? '#0f172a',
    colorMenu: colores.menu ?? '#1e293b',
    colorDias: colores.dias ?? '#1d4ed8',
    moduloRutinas: modulos.rutinas ?? true,
    moduloProgreso: modulos.progreso ?? true,
    moduloMedidas: modulos.medidas ?? true,
    moduloPagos: modulos.pagos ?? true,
    moduloNoticias: modulos.noticias ?? true,
    moduloCronometro: modulos.cronometro ?? true,
    agendaActiva: agenda.activa ?? false,
    agendaDuracionMin: agenda.duracionMin ?? 60,
    agendaPrecio: decimal(agenda.precio ?? 0),
    agendaHorasMinimasReserva: agenda.horasMinimasReserva ?? 2,
    agendaHorasMinimasCancelacion: agenda.horasMinimasCancelacion ?? 4,
    agendaDiasVisibles: agenda.diasVisibles ?? 14,
    landing: d.landing ?? { activa: false },
    activo: d.activo ?? true,
    spotifyPlaylist: d.spotifyPlaylist ?? '',
    createdAt: d.createdAt ?? new Date(),
    updatedAt: d.updatedAt ?? new Date(),
    deletedAt: d.deletedAt ?? null,
  };
}

// Nota: entrenadorId se pone a null en esta pasada (pass 1) y se restaura en pass 2.
function tUser(d) {
  const dp = d.datosPersonales || {};
  const stats = d.stats || {};
  const tf = d.twoFactor || {};
  return {
    id: hex(d._id),
    gymId: hex(d.gymId) ?? null,
    nombre: d.nombre,
    email: (d.email || '').toLowerCase(),
    password: d.password,
    role: d.role || 'socio',
    cargo: d.cargo ?? null,
    entrenadorId: null,
    codigoAcceso: d.codigoAcceso ?? '',
    fotoUrl: d.fotoUrl ?? '',
    mensajeMotivador: d.mensajeMotivador ?? 'HAZ QUE SUCEDA',
    identificacion: dp.identificacion ?? '',
    fechaNacimiento: dp.fechaNacimiento ?? '',
    sexo: dp.sexo ?? '',
    pesoActual: dp.pesoActual ?? 0,
    altura: dp.altura ?? 0,
    telefono: dp.telefono ?? '',
    racha: stats.racha ?? 0,
    asistenciasMes: stats.asistenciasMes ?? 0,
    disponibilidad: Array.isArray(d.disponibilidad) ? d.disponibilidad : [],
    fechaRegistro: d.fechaRegistro ?? d.createdAt ?? new Date(),
    fechaVencimiento: d.fechaVencimiento ?? null,
    resetToken: d.resetToken ?? null,
    resetTokenExpiry: d.resetTokenExpiry ?? null,
    emailVerified: d.emailVerified ?? false,
    verifyToken: d.verifyToken ?? null,
    verifyTokenExpiry: d.verifyTokenExpiry ?? null,
    twoFactorEnabled: tf.enabled ?? false,
    twoFactorSecret: tf.secret ?? null,
    twoFactorBackupCodes: tf.backupCodes ?? [],
    createdAt: d.createdAt ?? new Date(),
    updatedAt: d.updatedAt ?? new Date(),
    deletedAt: d.deletedAt ?? null,
  };
}

function tAsistencia(d) {
  return {
    id: hex(d._id), gymId: hex(d.gymId), usuarioId: hex(d.usuarioId),
    fecha: d.fecha ?? d.createdAt ?? new Date(), metodo: d.metodo || 'codigo',
    registradoPor: hex(d.registradoPor),
    createdAt: d.createdAt ?? new Date(), updatedAt: d.updatedAt ?? new Date(),
  };
}

function tAuditLog(d) {
  return {
    id: hex(d._id), gymId: hex(d.gymId), actorId: hex(d.actorId), actorRole: d.actorRole ?? null,
    accion: d.accion, recurso: d.recurso ?? null, recursoId: hex(d.recursoId),
    detalle: d.detalle ?? null, ip: d.ip ?? null, createdAt: d.createdAt ?? new Date(),
  };
}

function tDispositivo(d) {
  return {
    id: hex(d._id), gymId: hex(d.gymId), nombre: d.nombre, serie: (d.serie || '').toUpperCase(),
    marca: d.marca || 'zkteco', activo: d.activo ?? true, ultimaConexion: d.ultimaConexion ?? null,
    createdAt: d.createdAt ?? new Date(), updatedAt: d.updatedAt ?? new Date(),
  };
}

function tFeedback(d) {
  return {
    id: hex(d._id), usuarioId: hex(d.usuarioId), nombreUsuario: d.nombreUsuario ?? null,
    gymId: hex(d.gymId), gymNombre: d.gymNombre ?? null, mensaje: d.mensaje, leido: d.leido ?? false,
    createdAt: d.createdAt ?? new Date(), updatedAt: d.updatedAt ?? new Date(),
  };
}

function tMedidas(d) {
  return {
    id: hex(d._id), gymId: hex(d.gymId), usuarioId: hex(d.usuarioId), fecha: d.fecha ?? new Date(),
    peso: d.peso ?? null, cintura: d.cintura ?? null, cadera: d.cadera ?? null,
    pecho: d.pecho ?? null, brazo: d.brazo ?? null, muslo: d.muslo ?? null,
  };
}

function tProgreso(d) {
  return {
    id: hex(d._id), gymId: hex(d.gymId), usuarioId: hex(d.usuarioId),
    ejercicioNombre: d.ejercicioNombre, pesoKg: d.pesoKg ?? null, repeticiones: d.repeticiones ?? null,
    fecha: d.fecha ?? new Date(),
  };
}

function tNoticia(d) {
  return {
    id: hex(d._id), gymId: hex(d.gymId), titulo: d.titulo, descripcion: d.descripcion,
    dia: dia(d.dia), horaInicio: d.horaInicio ?? null, horaFin: d.horaFin ?? null,
    imageUrl: d.imageUrl ?? '', whatsappUrl: d.whatsappUrl ?? '', estado: d.estado ?? true,
    createdAt: d.createdAt ?? new Date(), updatedAt: d.updatedAt ?? new Date(), deletedAt: d.deletedAt ?? null,
  };
}

function tMetodoPago(d) {
  return {
    id: hex(d._id), gymId: hex(d.gymId), titulo: d.titulo, tipo: d.tipo || 'digital',
    imagenUrl: d.imagenUrl ?? null, descripcion: d.descripcion ?? null, datosClave: d.datosClave ?? null,
    activo: d.activo ?? true, createdAt: d.createdAt ?? new Date(), updatedAt: d.updatedAt ?? new Date(),
    deletedAt: d.deletedAt ?? null,
  };
}

function tPlan(d) {
  return {
    id: hex(d._id), gymId: hex(d.gymId), nombre: d.nombre, precio: decimal(d.precio ?? 0),
    dias: d.dias ?? 30, descripcion: d.descripcion, caracteristicas: d.caracteristicas ?? [],
    createdAt: d.createdAt ?? new Date(), updatedAt: d.updatedAt ?? new Date(), deletedAt: d.deletedAt ?? null,
  };
}

function tRutina(d) {
  return {
    id: hex(d._id), gymId: hex(d.gymId), usuarioId: hex(d.usuarioId), nombre: d.nombre ?? null,
    dia: dia(d.dia), enfoque: d.enfoque, fechaCreacion: d.fechaCreacion ?? d.createdAt ?? new Date(),
    createdAt: d.createdAt ?? new Date(), updatedAt: d.updatedAt ?? new Date(), deletedAt: d.deletedAt ?? null,
  };
}

function tEjercicios(rutinaMongo) {
  const lista = Array.isArray(rutinaMongo.ejercicios) ? rutinaMongo.ejercicios : [];
  return lista.map((e, idx) => ({
    id: hex(e._id) || new ObjectId().toHexString(),
    rutinaId: hex(rutinaMongo._id),
    nombre: e.nombre,
    series: e.series ?? 0,
    repeticiones: e.repeticiones != null ? String(e.repeticiones) : '0',
    instrucciones: e.instrucciones ?? null,
    imagenUrl: e.imagenUrl ?? null,
    completado: !!e.completado,
    orden: idx,
  }));
}

function tTransaccion(d) {
  return {
    id: hex(d._id), gymId: hex(d.gymId), usuarioId: hex(d.usuarioId), monto: decimal(d.monto ?? 0),
    metodoId: hex(d.metodoId), concepto: d.concepto ?? 'Membresía', diasAgregados: d.diasAgregados ?? 0,
    fecha: d.fecha ?? d.createdAt ?? new Date(), registradoPor: hex(d.registradoPor),
    createdAt: d.createdAt ?? new Date(), updatedAt: d.updatedAt ?? new Date(), deletedAt: d.deletedAt ?? null,
  };
}

function tCita(d) {
  return {
    id: hex(d._id), gymId: hex(d.gymId), socioId: hex(d.socioId), profesionalId: hex(d.profesionalId),
    fecha: d.fecha, hora: d.hora, duracionMin: d.duracionMin ?? 60,
    estado: d.estado || 'agendada', precio: decimal(d.precio ?? 0), nota: d.nota ?? '',
    canceladaPor: hex(d.canceladaPor),
    createdAt: d.createdAt ?? new Date(), updatedAt: d.updatedAt ?? new Date(),
  };
}

function tInvitacion(d) {
  return {
    id: hex(d._id), gymId: hex(d.gymId), token: d.token, creadaPor: hex(d.creadaPor),
    usada: d.usada ?? false, usadaPor: hex(d.usadaPor), expiraEn: d.expiraEn ?? new Date(),
    createdAt: d.createdAt ?? new Date(), updatedAt: d.updatedAt ?? new Date(),
  };
}

// ── Motor genérico de copia por lotes ───────────────────────────────────────

async function copiarColeccion(db, prisma, nombreColeccion, delegate, transform, { strict = false } = {}) {
  const cursor = db.collection(nombreColeccion).find({});
  let total = 0;
  let lote = [];

  async function flush() {
    if (!lote.length) return;
    if (strict) {
      for (const fila of lote) {
        for (const [campo, valor] of Object.entries(fila)) {
          if (valor === undefined) throw new Error(`[${nombreColeccion}] campo "${campo}" undefined en doc, revisa el transform (--strict)`);
        }
      }
    }
    if (!DRY_RUN) {
      await delegate.createMany({ data: lote, skipDuplicates: true });
    }
    total += lote.length;
    lote = [];
  }

  for await (const doc of cursor) {
    lote.push(transform(doc));
    if (lote.length >= LOTE) await flush();
  }
  await flush();
  return total;
}

async function asegurarTablasVacias(prisma) {
  const tablas = [
    ['gym', 'gyms'], ['user', 'users'], ['asistencia', 'asistencias'], ['auditLog', 'audit_logs'],
    ['dispositivo', 'dispositivos'], ['feedback', 'feedbacks'], ['medidas', 'medidas'],
    ['progreso', 'progresos'], ['noticia', 'noticias'], ['metodoPago', 'metodos_pago'],
    ['plan', 'planes'], ['rutina', 'rutinas'], ['rutinaEjercicio', 'rutina_ejercicios'],
    ['transaccion', 'transacciones'], ['cita', 'citas'], ['invitacion', 'invitaciones'],
  ];
  for (const [modelo, tabla] of tablas) {
    const n = await prisma[modelo].count();
    if (n > 0) {
      throw new Error(`La tabla "${tabla}" ya tiene ${n} filas. Aborta para no duplicar/corromper datos. Usa --force si de verdad quieres continuar.`);
    }
  }
}

// ── Verificación post-migración ─────────────────────────────────────────────

async function verificar(db, prisma, counts) {
  log('\n── Verificación ──');
  let ok = true;

  const paresColeccionModelo = [
    ['gyms', 'gym'], ['users', 'user'], ['asistencias', 'asistencia'], ['auditlogs', 'auditLog'],
    ['dispositivos', 'dispositivo'], ['feedbacks', 'feedback'], ['medidas', 'medidas'],
    ['progresos', 'progreso'], ['noticias', 'noticia'], ['metodopagos', 'metodoPago'],
    ['plans', 'plan'], ['rutinas', 'rutina'], ['transaccions', 'transaccion'],
    ['citas', 'cita'], ['invitacions', 'invitacion'],
  ];

  for (const [coleccion, modelo] of paresColeccionModelo) {
    const enMongo = await db.collection(coleccion).countDocuments({});
    const enPostgres = DRY_RUN ? counts[coleccion] ?? 0 : await prisma[modelo].count();
    const estado = enMongo === enPostgres ? 'OK' : 'DIFERENCIA';
    if (enMongo !== enPostgres) ok = false;
    log(`  ${coleccion.padEnd(14)} mongo=${enMongo}  postgres=${enPostgres}  ${estado}`);
  }

  // Suma de ejercicios embebidos vs filas de rutina_ejercicios.
  const rutinasMongo = await db.collection('rutinas').find({}, { projection: { ejercicios: 1 } }).toArray();
  const totalEjerciciosMongo = rutinasMongo.reduce((acc, r) => acc + (Array.isArray(r.ejercicios) ? r.ejercicios.length : 0), 0);
  const totalEjerciciosPg = DRY_RUN ? counts.rutina_ejercicios ?? 0 : await prisma.rutinaEjercicio.count();
  const estadoEj = totalEjerciciosMongo === totalEjerciciosPg ? 'OK' : 'DIFERENCIA';
  if (totalEjerciciosMongo !== totalEjerciciosPg) ok = false;
  log(`  rutina_ejercicios (suma embebidos) mongo=${totalEjerciciosMongo}  postgres=${totalEjerciciosPg}  ${estadoEj}`);

  if (!DRY_RUN) {
    // Spot-check de integridad de FK: cero filas huérfanas esperadas.
    const chequeos = [
      ['users.gym_id -> gyms', Prisma.sql`SELECT count(*)::int AS n FROM users u LEFT JOIN gyms g ON g.id = u.gym_id WHERE u.gym_id IS NOT NULL AND g.id IS NULL`],
      ['users.entrenador_id -> users', Prisma.sql`SELECT count(*)::int AS n FROM users u LEFT JOIN users e ON e.id = u.entrenador_id WHERE u.entrenador_id IS NOT NULL AND e.id IS NULL`],
      ['rutinas.usuario_id -> users', Prisma.sql`SELECT count(*)::int AS n FROM rutinas r LEFT JOIN users u ON u.id = r.usuario_id WHERE u.id IS NULL`],
      ['transacciones.metodo_id -> metodos_pago', Prisma.sql`SELECT count(*)::int AS n FROM transacciones t LEFT JOIN metodos_pago m ON m.id = t.metodo_id WHERE t.metodo_id IS NOT NULL AND m.id IS NULL`],
      ['citas.profesional_id -> users', Prisma.sql`SELECT count(*)::int AS n FROM citas c LEFT JOIN users u ON u.id = c.profesional_id WHERE u.id IS NULL`],
      ['invitaciones.creada_por -> users', Prisma.sql`SELECT count(*)::int AS n FROM invitaciones i LEFT JOIN users u ON u.id = i.creada_por WHERE u.id IS NULL`],
    ];
    for (const [nombre, sql] of chequeos) {
      const [{ n }] = await prisma.$queryRaw(sql);
      const estado = n === 0 ? 'OK' : 'HUÉRFANOS';
      if (n !== 0) ok = false;
      log(`  FK ${nombre.padEnd(32)} huérfanos=${n}  ${estado}`);
    }
  }

  log(ok ? '\n✅ Verificación OK' : '\n❌ Verificación con diferencias — no promuevas este resultado a producción');
  return ok;
}

// ── Orquestación ─────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI no está definido.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está definido.');

  log(DRY_RUN
    ? '🔎 DRY RUN — solo cuenta, no escribe nada. Ejecuta con CONFIRMAR_MIGRACION=si para migrar de verdad.'
    : '⚠️  EJECUCIÓN REAL — escribiendo en Postgres.');

  const mongoClient = new MongoClient(process.env.MONGO_URI);
  await mongoClient.connect();
  const db = mongoClient.db();
  log('✅ Conectado a MongoDB');

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  // Cliente BASE, sin las extensiones de softDelete/objectId (ver comentario al inicio del archivo).
  const prisma = new PrismaClient({ adapter });
  await prisma.$queryRaw`SELECT 1`;
  log('✅ Conectado a Postgres');

  try {
    if (!DRY_RUN && !FORCE) {
      await asegurarTablasVacias(prisma);
    }

    const counts = {};

    // 1 — Gym (sin dependencias)
    counts.gyms = await copiarColeccion(db, prisma, 'gyms', prisma.gym, tGym, { strict: STRICT });
    log(`✅ gyms: ${counts.gyms}`);

    // 2 — User, dos pasadas (entrenadorId es auto-referencial)
    counts.users = await copiarColeccion(db, prisma, 'users', prisma.user, tUser, { strict: STRICT });
    log(`✅ users (pass 1, sin entrenadorId): ${counts.users}`);
    if (!DRY_RUN) {
      const cursorUsers = db.collection('users').find({ entrenadorId: { $exists: true, $ne: null } }, { projection: { _id: 1, entrenadorId: 1 } });
      let restaurados = 0;
      for await (const u of cursorUsers) {
        await prisma.user.update({ where: { id: hex(u._id) }, data: { entrenadorId: hex(u.entrenadorId) } });
        restaurados++;
      }
      log(`✅ users (pass 2, entrenadorId restaurado): ${restaurados}`);
    }

    // 3 — Modelos que solo dependen de Gym
    counts.metodopagos = await copiarColeccion(db, prisma, 'metodopagos', prisma.metodoPago, tMetodoPago, { strict: STRICT });
    log(`✅ metodopagos: ${counts.metodopagos}`);
    counts.plans = await copiarColeccion(db, prisma, 'plans', prisma.plan, tPlan, { strict: STRICT });
    log(`✅ plans: ${counts.plans}`);
    counts.noticias = await copiarColeccion(db, prisma, 'noticias', prisma.noticia, tNoticia, { strict: STRICT });
    log(`✅ noticias: ${counts.noticias}`);
    counts.dispositivos = await copiarColeccion(db, prisma, 'dispositivos', prisma.dispositivo, tDispositivo, { strict: STRICT });
    log(`✅ dispositivos: ${counts.dispositivos}`);

    // 4 — Dependen de Gym + User
    counts.feedbacks = await copiarColeccion(db, prisma, 'feedbacks', prisma.feedback, tFeedback, { strict: STRICT });
    log(`✅ feedbacks: ${counts.feedbacks}`);
    counts.medidas = await copiarColeccion(db, prisma, 'medidas', prisma.medidas, tMedidas, { strict: STRICT });
    log(`✅ medidas: ${counts.medidas}`);
    counts.progresos = await copiarColeccion(db, prisma, 'progresos', prisma.progreso, tProgreso, { strict: STRICT });
    log(`✅ progresos: ${counts.progresos}`);

    // 5 — Asistencia
    counts.asistencias = await copiarColeccion(db, prisma, 'asistencias', prisma.asistencia, tAsistencia, { strict: STRICT });
    log(`✅ asistencias: ${counts.asistencias}`);

    // 6 — Rutina + tabla hija (expande el array embebido con `orden` = índice)
    //
    // Mongo no exigía que el usuarioId existiera de verdad, así que quedan
    // rutinas de socios que se borraron: apuntan a alguien que ya no está.
    // Postgres sí lo exige, y no hay a quién atribuírselas, así que se
    // descartan y se informa cuántas fueron.
    const idsUsuarios = new Set(
      (await db.collection('users').find({}, { projection: { _id: 1 } }).toArray())
        .map((u) => hex(u._id))
    );
    const cursorRutinas = db.collection('rutinas').find({});
    let totalRutinas = 0;
    let totalEjercicios = 0;
    let rutinasHuerfanas = 0;
    for await (const r of cursorRutinas) {
      const dueno = hex(r.usuarioId);
      if (!dueno || !idsUsuarios.has(dueno)) {
        rutinasHuerfanas++;
        continue;
      }
      if (!DRY_RUN) await prisma.rutina.create({ data: tRutina(r) });
      totalRutinas++;
      const ejercicios = tEjercicios(r);
      if (ejercicios.length && !DRY_RUN) {
        await prisma.rutinaEjercicio.createMany({ data: ejercicios, skipDuplicates: true });
      }
      totalEjercicios += ejercicios.length;
    }
    if (rutinasHuerfanas) {
      log(`⚠️  ${rutinasHuerfanas} rutina(s) descartada(s): su socio ya no existe en Mongo`);
    }
    counts.rutinas = totalRutinas;
    counts.rutina_ejercicios = totalEjercicios;
    log(`✅ rutinas: ${totalRutinas} (con ${totalEjercicios} ejercicios embebidos expandidos)`);

    // 7 — AuditLog (recursoId es polimórfico, sin FK real)
    counts.auditlogs = await copiarColeccion(db, prisma, 'auditlogs', prisma.auditLog, tAuditLog, { strict: STRICT });
    log(`✅ auditlogs: ${counts.auditlogs}`);

    // 8 — Transaccion (depende de Gym, User, MetodoPago)
    counts.transaccions = await copiarColeccion(db, prisma, 'transaccions', prisma.transaccion, tTransaccion, { strict: STRICT });
    log(`✅ transaccions: ${counts.transaccions}`);

    // 9 — Cita e Invitacion (dependen de Gym + User; van después para que las FK ya existan)
    counts.citas = await copiarColeccion(db, prisma, 'citas', prisma.cita, tCita, { strict: STRICT });
    log(`✅ citas: ${counts.citas}`);
    counts.invitacions = await copiarColeccion(db, prisma, 'invitacions', prisma.invitacion, tInvitacion, { strict: STRICT });
    log(`✅ invitacions: ${counts.invitacions}`);

    const ok = await verificar(db, prisma, counts);
    if (!ok) process.exitCode = 1;
  } finally {
    await mongoClient.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('❌ ETL abortada — el destino puede haber quedado en estado parcial, no cortar:', err.message);
  process.exit(1);
});
