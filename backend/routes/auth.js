const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { getPrismaClient } = require('../prisma/client');
const { esIdValido } = require('../lib/ids');
const { toApiUser, fromApiDatosPersonales } = require('../lib/userMapper');
const { verificarToken, soloAdmin, esAdmin, JWT_SECRET } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

const prisma = getPrismaClient();

const TOKEN_EXPIRY = '8h';
// Tokens de enlace y transporter viven en helpers/ para que gym.js (invitación
// de administradores) comparta exactamente la misma configuración.
const { hashToken } = require('../helpers/tokens');
const { transporter, emailConfigurado, remitente } = require('../helpers/email');

// Template del email
const emailTemplate = (nombre, resetUrl) => `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12)">
  <div style="background:linear-gradient(160deg,#1e3a8a,#0f172a);padding:28px;text-align:center">
    <h1 style="color:#ffffff;font-size:22px;margin:0;letter-spacing:-0.5px">KODIAK GYM</h1>
    <p style="color:#93c5fd;font-size:11px;margin:4px 0 0;letter-spacing:2px">STRENGTH · DISCIPLINE · POWER</p>
  </div>
  <div style="background:#f8fbff;padding:32px">
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 12px">Recuperar contraseña</h2>
    <p style="color:#475569;font-size:14px;margin:0 0 8px">Hola <strong>${nombre}</strong>,</p>
    <p style="color:#475569;font-size:14px;margin:0 0 24px">Recibimos una solicitud para restablecer tu contraseña. El enlace expira en <strong>30 minutos</strong>.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${resetUrl}" style="background:#1d4ed8;color:#ffffff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
        Restablecer contraseña
      </a>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:20px 0 0">Si no solicitaste esto, ignora este correo.</p>
  </div>
</div>`;

// Template del email de verificación de cuenta
const verifyEmailTemplate = (nombre, verifyUrl) => `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12)">
  <div style="background:linear-gradient(160deg,#1e3a8a,#0f172a);padding:28px;text-align:center">
    <h1 style="color:#ffffff;font-size:22px;margin:0;letter-spacing:-0.5px">KODIAK GYM</h1>
    <p style="color:#93c5fd;font-size:11px;margin:4px 0 0;letter-spacing:2px">STRENGTH · DISCIPLINE · POWER</p>
  </div>
  <div style="background:#f8fbff;padding:32px">
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 12px">Verifica tu cuenta</h2>
    <p style="color:#475569;font-size:14px;margin:0 0 8px">Hola <strong>${nombre}</strong>,</p>
    <p style="color:#475569;font-size:14px;margin:0 0 24px">Confirma tu correo para activar todas las funciones de tu cuenta. El enlace expira en <strong>24 horas</strong>.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${verifyUrl}" style="background:#1d4ed8;color:#ffffff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
        Verificar mi correo
      </a>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:20px 0 0">Si no creaste esta cuenta, ignora este correo.</p>
  </div>
</div>`;

// Genera un token de verificación, lo guarda hasheado y envía el correo (best-effort).
async function enviarVerificacion(usuario) {
    if (!emailConfigurado()) return;
    const token = crypto.randomBytes(32).toString('hex');
    const verifyToken = hashToken(token);
    const verifyTokenExpiry = new Date(Date.now() + 24 * 3600000); // 24 horas
    await prisma.user.update({ where: { id: usuario.id }, data: { verifyToken, verifyTokenExpiry } });
    const verifyUrl = `${process.env.FRONTEND_URL || 'https://gimnacio-app.vercel.app'}/verify-email?token=${token}`;
    try {
        await transporter.sendMail({
            from: remitente(),
            to: usuario.email,
            subject: 'Verifica tu cuenta — Kodiak Gym',
            html: verifyEmailTemplate(usuario.nombre, verifyUrl)
        });
    } catch (err) {
        console.error('No se pudo enviar el correo de verificación:', err.message);
    }
}

// ✅ OLVIDÉ MI CONTRASEÑA
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ mensaje: 'El correo es obligatorio' });

        if (!emailConfigurado()) {
            console.error('Sin configuración de correo (SMTP_HOST o EMAIL_USER/EMAIL_PASS): no se puede enviar el correo de recuperación');
            return res.status(500).json({ mensaje: 'El servicio de correo no está disponible en este momento' });
        }

        // Respuesta genérica siempre (evita enumeración de usuarios).
        const respuestaGenerica = { mensaje: 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.' };

        const usuario = await prisma.user.findFirst({ where: { email: email.toLowerCase().trim() } });
        if (!usuario) {
            return res.json(respuestaGenerica);
        }

        const token = crypto.randomBytes(32).toString('hex');
        const resetToken = hashToken(token); // se guarda hasheado
        const resetTokenExpiry = new Date(Date.now() + 1800000); // 30 minutos
        await prisma.user.update({ where: { id: usuario.id }, data: { resetToken, resetTokenExpiry } });

        const resetUrl = `${process.env.FRONTEND_URL || 'https://gimnacio-app.vercel.app'}/reset-password?token=${token}`;

        await transporter.sendMail({
            from: remitente(),
            to: usuario.email,
            subject: 'Recuperar contraseña — Kodiak Gym',
            html: emailTemplate(usuario.nombre, resetUrl)
        });

        res.json(respuestaGenerica);
    } catch (error) {
        console.error('Error forgot-password:', error.message);
        res.status(500).json({ mensaje: 'Error al enviar el correo' });
    }
});

// ✅ RESTABLECER CONTRASEÑA
router.post('/reset-password', async (req, res) => {
    try {
        const { token, nuevaPassword } = req.body;
        if (!token || !nuevaPassword) {
            return res.status(400).json({ mensaje: 'Token y nueva contraseña son obligatorios' });
        }
        if (typeof nuevaPassword !== 'string' || nuevaPassword.length < 8) {
            return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres' });
        }

        const usuario = await prisma.user.findFirst({
            where: { resetToken: hashToken(token), resetTokenExpiry: { gt: new Date() } }
        });

        if (!usuario) {
            return res.status(400).json({ mensaje: 'El enlace es inválido o ya expiró' });
        }

        const salt = await bcrypt.genSalt(10);
        const password = await bcrypt.hash(nuevaPassword, salt);
        await prisma.user.update({
            where: { id: usuario.id },
            // Completar el enlace demuestra el control del buzón: sirve como
            // verificación del correo (es el único paso que da un admin invitado).
            data: { password, resetToken: null, resetTokenExpiry: null, emailVerified: true }
        });

        res.json({ mensaje: 'Contraseña actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al restablecer contraseña' });
    }
});

// El Client ID debe venir de configuración (nunca hardcodeado en el código).
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
// Client IDs adicionales aceptados como audience válida (clientes nativos Android/iOS).
const GOOGLE_AUDIENCES = [
    GOOGLE_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID
].filter(Boolean);
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ✅ LOGIN CON GOOGLE
router.post('/google', async (req, res) => {
    try {
        if (!GOOGLE_CLIENT_ID) {
            console.error('GOOGLE_CLIENT_ID no está configurado');
            return res.status(500).json({ mensaje: 'Autenticación con Google no disponible' });
        }

        const { credential, access_token, gymId } = req.body;

        let email, name, picture, sub;

        if (access_token) {
            // Un access_token NO está ligado por sí mismo a nuestra app: primero hay que
            // validar con tokeninfo que su audience sea uno de nuestros Client IDs,
            // de lo contrario un token de cualquier app Google sería aceptado (suplantación).
            const tempClient = new OAuth2Client(GOOGLE_CLIENT_ID);
            const tokenInfo = await tempClient.getTokenInfo(access_token);
            const aud = tokenInfo.aud || tokenInfo.azp;
            if (!aud || !GOOGLE_AUDIENCES.includes(aud)) {
                return res.status(401).json({ mensaje: 'Token de Google no válido para esta aplicación' });
            }

            tempClient.setCredentials({ access_token });
            const userInfoRes = await tempClient.request({
                url: 'https://www.googleapis.com/oauth2/v3/userinfo'
            });
            const userInfo = userInfoRes.data;
            email   = userInfo.email;
            name    = userInfo.name;
            picture = userInfo.picture;
            sub     = userInfo.sub;
        } else {
            const ticket = await googleClient.verifyIdToken({
                idToken: credential,
                audience: GOOGLE_AUDIENCES
            });
            ({ email, name, picture, sub } = ticket.getPayload());
        }

        if (!email) {
            return res.status(401).json({ mensaje: 'La cuenta de Google no expone un correo' });
        }
        const emailNorm = email.toLowerCase().trim();

        // El superadmin no pertenece a ningún gimnasio (mismo criterio que /login).
        let usuario = await prisma.user.findFirst({ where: { email: emailNorm, role: 'superadmin' } });

        if (!usuario) {
            // Multi-gym: la cuenta vive DENTRO del gimnasio elegido en el selector.
            // Sin gymId el usuario quedaría huérfano y su JWT saldría con gymId null,
            // dejando vacía toda consulta con alcance de gimnasio.
            if (!gymId || !esIdValido(gymId)) {
                return res.status(400).json({ mensaje: 'Debes seleccionar un gimnasio válido' });
            }
            const gymValido = await prisma.gym.findFirst({ where: { id: gymId, activo: true }, select: { id: true } });
            if (!gymValido) {
                return res.status(400).json({ mensaje: 'El gimnasio no existe o no está activo' });
            }

            // El índice único es {email, gymId}: el mismo correo puede ser socio de
            // varios gimnasios, así que la búsqueda va acotada al gym elegido.
            usuario = await prisma.user.findFirst({ where: { email: emailNorm, gymId } });

            // Cuentas heredadas que Google creó sin gimnasio: se adoptan en el gym
            // elegido en vez de duplicarlas (el índice compuesto lo permitiría).
            if (!usuario) {
                const huerfano = await prisma.user.findFirst({ where: { email: emailNorm, gymId: null } });
                if (huerfano) {
                    usuario = await prisma.user.update({ where: { id: huerfano.id }, data: { gymId } });
                }
            }

            if (!usuario) {
                const salt = await bcrypt.genSalt(10);
                usuario = await prisma.user.create({
                    data: {
                        gymId,
                        nombre: name,
                        email: emailNorm,
                        password: await bcrypt.hash(sub + Date.now(), salt),
                        role: 'socio',
                        fotoUrl: picture || '',
                        emailVerified: true   // el correo ya viene verificado por Google
                    }
                });
            }
        }

        const token = jwt.sign(
            { id: usuario.id, role: usuario.role, cargo: usuario.cargo || null, gymId: usuario.gymId || null },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.json({
            mensaje: 'Login con Google exitoso',
            token,
            usuario: { _id: usuario.id, nombre: usuario.nombre, role: usuario.role, cargo: usuario.cargo || null, gymId: usuario.gymId || null }
        });
    } catch (error) {
        console.error('Error Google auth:', error.message);
        res.status(401).json({ mensaje: 'Autenticación con Google fallida' });
    }
});

// ✅ OBTENER TODOS LOS USUARIOS (SOLO ADMINS)
router.get('/usuarios', verificarToken, soloAdmin, async (req, res) => {
    try {
        // Paginación retro-compatible: sin ?page se devuelve el array completo
        // (como siempre); con ?page se devuelve { data, total, page, limit, pages }.
        const where = { gymId: req.gymId };
        if (req.query.buscar) {
            const termino = String(req.query.buscar).trim();
            where.OR = [
                { nombre: { contains: termino, mode: 'insensitive' } },
                { email: { contains: termino, mode: 'insensitive' } }
            ];
        }

        const paginar = req.query.page !== undefined;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

        const args = { where, orderBy: { createdAt: 'desc' } };
        if (paginar) { args.skip = (page - 1) * limit; args.take = limit; }
        const usuarios = await prisma.user.findMany(args);

        const usuariosConDatos = usuarios.map(usuario => {
            let diasRestantes = 0;
            if (usuario.fechaVencimiento) {
                const hoy = new Date();
                const vencimiento = new Date(usuario.fechaVencimiento);
                diasRestantes = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
                if (diasRestantes < 0) diasRestantes = 0;
            }
            return {
                ...toApiUser(usuario),
                diasRestantes,
                estadoMembresia: diasRestantes > 0 ? 'activo' : 'vencido'
            };
        });

        if (paginar) {
            const total = await prisma.user.count({ where });
            return res.json({ data: usuariosConDatos, total, page, limit, pages: Math.ceil(total / limit) });
        }
        res.json(usuariosConDatos);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener usuarios' });
    }
});

// ✅ CREAR SOCIO (SOLO ADMINS) — para matrícula desde recepción
router.post('/crear-socio', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { nombre, email, telefono, password } = req.body;
        if (!nombre) return res.status(400).json({ mensaje: 'El nombre es obligatorio' });

        // El correo es opcional; si no se da, se genera uno interno para cumplir el índice único.
        const emailNorm = email
            ? email.toLowerCase().trim()
            : `socio_${Date.now()}${Math.floor(Math.random() * 1000)}@sin-correo.local`;

        const existe = await prisma.user.findFirst({ where: { email: emailNorm, gymId: req.gymId }, select: { id: true } });
        if (existe) return res.status(400).json({ mensaje: 'El correo ya está registrado en este gimnasio' });

        // Contraseña: la dada (mín 8) o una temporal aleatoria si no la ponen.
        const passPlano = (typeof password === 'string' && password.length >= 8)
            ? password
            : crypto.randomBytes(6).toString('hex');
        const salt = await bcrypt.genSalt(10);

        const socio = await prisma.user.create({
            data: {
                gymId: req.gymId,
                nombre,
                email: emailNorm,
                password: await bcrypt.hash(passPlano, salt),
                role: 'socio',
                emailVerified: true,
                telefono: telefono || ''
            }
        });
        await registrarAuditoria(req, 'CREAR_SOCIO', { recurso: 'User', recursoId: socio.id });

        res.status(201).json({
            mensaje: 'Socio creado',
            socio: { _id: socio.id, nombre: socio.nombre, email: socio.email },
            passwordTemporal: (typeof password === 'string' && password.length >= 8) ? null : passPlano
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear socio' });
    }
});

// ✅ CREAR ENTRENADOR (SOLO ADMINS)
router.post('/crear-entrenador', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { nombre, email, password } = req.body;
        if (!nombre || !email || !password) {
            return res.status(400).json({ mensaje: 'Nombre, correo y contraseña son obligatorios' });
        }
        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres' });
        }
        const emailNorm = email.toLowerCase().trim();
        const existe = await prisma.user.findFirst({ where: { email: emailNorm, gymId: req.gymId }, select: { id: true } });
        if (existe) return res.status(400).json({ mensaje: 'El correo ya está registrado en este gimnasio' });

        const salt = await bcrypt.genSalt(10);
        const entrenador = await prisma.user.create({
            data: {
                gymId: req.gymId,
                nombre,
                email: emailNorm,
                password: await bcrypt.hash(password, salt),
                role: 'entrenador',
                emailVerified: true
            }
        });
        await registrarAuditoria(req, 'CREAR_ENTRENADOR', { recurso: 'User', recursoId: entrenador.id });

        res.status(201).json({ mensaje: 'Entrenador creado', entrenador: { _id: entrenador.id, nombre: entrenador.nombre, email: entrenador.email } });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear entrenador' });
    }
});

// Cargos válidos al crear personal. 'entrenador' se acepta como cargo en el
// formulario pero crea un usuario con role 'entrenador' (rol propio, con su
// zona de la app); los demás crean role 'empleado' con el cargo indicado.
const CARGOS_EMPLEADO = ['recepcionista', 'limpieza', 'nutricionista', 'entrenador'];

// ✅ CREAR EMPLEADO (SOLO ADMINS) — recepcionista, entrenador, limpieza, nutricionista
router.post('/crear-empleado', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { nombre, email, password, cargo } = req.body;
        if (!nombre || !email || !password) {
            return res.status(400).json({ mensaje: 'Nombre, correo y contraseña son obligatorios' });
        }
        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres' });
        }
        if (!CARGOS_EMPLEADO.includes(cargo)) {
            return res.status(400).json({ mensaje: 'Cargo inválido' });
        }
        const emailNorm = email.toLowerCase().trim();
        const existe = await prisma.user.findFirst({ where: { email: emailNorm, gymId: req.gymId }, select: { id: true } });
        if (existe) return res.status(400).json({ mensaje: 'El correo ya está registrado en este gimnasio' });

        const salt = await bcrypt.genSalt(10);
        const empleado = await prisma.user.create({
            data: {
                gymId: req.gymId,
                nombre,
                email: emailNorm,
                password: await bcrypt.hash(password, salt),
                role: cargo === 'entrenador' ? 'entrenador' : 'empleado',
                cargo: cargo === 'entrenador' ? null : cargo,
                emailVerified: true
            }
        });
        await registrarAuditoria(req, 'CREAR_EMPLEADO', { recurso: 'User', recursoId: empleado.id, detalle: { cargo } });

        res.status(201).json({
            mensaje: 'Empleado creado',
            empleado: { _id: empleado.id, nombre: empleado.nombre, email: empleado.email, role: empleado.role, cargo: empleado.cargo }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al crear empleado' });
    }
});

// ✅ LISTAR EMPLEADOS (SOLO ADMINS) — entrenadores y empleados del gym
router.get('/empleados', verificarToken, soloAdmin, async (req, res) => {
    try {
        const empleados = await prisma.user.findMany({
            where: { gymId: req.gymId, role: { in: ['entrenador', 'empleado'] } },
            select: { id: true, nombre: true, email: true, role: true, cargo: true, fotoUrl: true, createdAt: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(empleados.map(({ id, ...e }) => ({ ...e, _id: id })));
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener empleados' });
    }
});

// ✅ ELIMINAR EMPLEADO (SOLO ADMINS) — borrado suave, solo entrenadores/empleados
router.delete('/empleados/:id', verificarToken, soloAdmin, async (req, res) => {
    try {
        // El filtro por rol evita que por esta ruta se borre a un socio o a otro admin.
        const filtro = { id: req.params.id, gymId: req.gymId, role: { in: ['entrenador', 'empleado'] } };
        const empleado = await prisma.user.findFirst({ where: filtro, select: { id: true } });
        if (!empleado) return res.status(404).json({ mensaje: 'Empleado no encontrado' });

        await prisma.user.softDelete(filtro);
        await registrarAuditoria(req, 'ELIMINAR_EMPLEADO', { recurso: 'User', recursoId: req.params.id });
        res.json({ mensaje: 'Empleado eliminado' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar empleado' });
    }
});

// ✅ ASIGNAR ENTRENADOR A UN SOCIO (SOLO ADMINS)
router.put('/asignar-entrenador/:socioId', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { entrenadorId } = req.body; // null para desasignar
        if (entrenadorId) {
            const entrenador = await prisma.user.findFirst({ where: { id: entrenadorId, gymId: req.gymId, role: 'entrenador' }, select: { id: true } });
            if (!entrenador) return res.status(404).json({ mensaje: 'Entrenador no encontrado en este gimnasio' });
        }
        const socioActual = await prisma.user.findFirst({ where: { id: req.params.socioId, gymId: req.gymId, role: 'socio' }, select: { id: true } });
        if (!socioActual) return res.status(404).json({ mensaje: 'Socio no encontrado' });

        const socio = await prisma.user.update({ where: { id: socioActual.id }, data: { entrenadorId: entrenadorId || null } });
        await registrarAuditoria(req, 'ASIGNAR_ENTRENADOR', { recurso: 'User', recursoId: socio.id, detalle: { entrenadorId: entrenadorId || null } });

        res.json({ mensaje: 'Entrenador asignado', socio: toApiUser(socio) });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al asignar entrenador' });
    }
});

// ✅ RENOVAR MEMBRESÍA (SOLO ADMINS)
router.put('/renovar/:id', verificarToken, soloAdmin, async (req, res) => {
    try {
        const dias = Number.parseInt(req.body.dias, 10);
        if (!Number.isInteger(dias) || dias <= 0) {
            return res.status(400).json({ mensaje: 'dias debe ser un entero positivo' });
        }
        const usuarioActual = await prisma.user.findFirst({ where: { id: req.params.id, gymId: req.gymId } });
        if (!usuarioActual) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        const hoy = new Date();
        const fechaBase = usuarioActual.fechaVencimiento && new Date(usuarioActual.fechaVencimiento) > hoy
            ? new Date(usuarioActual.fechaVencimiento)
            : hoy;
        fechaBase.setDate(fechaBase.getDate() + dias);

        const usuario = await prisma.user.update({ where: { id: usuarioActual.id }, data: { fechaVencimiento: fechaBase } });
        await registrarAuditoria(req, 'RENOVAR_MEMBRESIA', { recurso: 'User', recursoId: usuario.id, detalle: { dias } });

        res.json({
            mensaje: 'Membresía renovada exitosamente',
            usuario: {
                _id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                role: usuario.role,
                fechaVencimiento: usuario.fechaVencimiento
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al renovar membresía' });
    }
});

// ✅ LIMPIAR MEMBRESÍA (SOLO ADMINS)
router.put('/limpiar-membresia/:id', verificarToken, soloAdmin, async (req, res) => {
    try {
        const usuarioActual = await prisma.user.findFirst({ where: { id: req.params.id, gymId: req.gymId }, select: { id: true } });
        if (!usuarioActual) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        await prisma.user.update({ where: { id: usuarioActual.id }, data: { fechaVencimiento: null } });

        res.json({ mensaje: 'Membresía limpiada exitosamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al limpiar membresía' });
    }
});

// ✅ ACTUALIZAR PERFIL (propio usuario o admin)
// ✅ CAMBIAR LA PROPIA CONTRASEÑA (con sesión iniciada)
// Distinto de /reset-password, que va por correo: aquí el usuario ya está
// dentro y debe demostrar que conoce la contraseña actual, para que una sesión
// olvidada en un equipo ajeno no permita apropiarse de la cuenta.
router.put('/cambiar-password', verificarToken, async (req, res) => {
    try {
        const { actual, nueva } = req.body;

        if (typeof nueva !== 'string' || nueva.length < 8) {
            return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 8 caracteres' });
        }
        if (typeof actual !== 'string' || !actual) {
            return res.status(400).json({ mensaje: 'Debes escribir tu contraseña actual' });
        }
        if (actual === nueva) {
            return res.status(400).json({ mensaje: 'La nueva contraseña debe ser distinta de la actual' });
        }

        const usuario = await prisma.user.findUnique({ where: { id: req.userId }, omit: { password: false } });
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        // Las cuentas creadas por Google no tienen contraseña utilizable.
        const esValida = usuario.password && await bcrypt.compare(actual, usuario.password);
        if (!esValida) {
            return res.status(401).json({ mensaje: 'La contraseña actual no es correcta' });
        }

        const salt = await bcrypt.genSalt(10);
        const nuevoHash = await bcrypt.hash(nueva, salt);
        await prisma.user.update({ where: { id: usuario.id }, data: { password: nuevoHash } });

        await registrarAuditoria(req, 'CAMBIAR_PASSWORD', { recurso: 'User', recursoId: usuario.id });

        res.json({ mensaje: 'Contraseña actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al cambiar la contraseña' });
    }
});

router.put('/actualizar-perfil/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;

        if (req.userId !== id && !esAdmin(req)) {
            return res.status(403).json({ mensaje: 'No autorizado para actualizar este perfil' });
        }

        // Lista BLANCA: solo estos campos pueden actualizarse por esta vía
        // (evita tocar password, email, role, gymId, resetToken, stats, etc.).
        const datosActualizados = {};
        if (req.body.nombre !== undefined) datosActualizados.nombre = req.body.nombre;
        if (req.body.fotoUrl !== undefined) datosActualizados.fotoUrl = req.body.fotoUrl;
        if (req.body.mensajeMotivador !== undefined) datosActualizados.mensajeMotivador = req.body.mensajeMotivador;
        Object.assign(datosActualizados, fromApiDatosPersonales(req.body.datosPersonales));

        // El admin sólo puede tocar usuarios de su propio gym; el socio, sólo el suyo.
        const filtro = esAdmin(req) ? { id, gymId: req.gymId } : { id };
        const usuarioActual = await prisma.user.findFirst({ where: filtro, select: { id: true } });
        if (!usuarioActual) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        const usuario = await prisma.user.update({ where: { id: usuarioActual.id }, data: datosActualizados });

        res.json({ mensaje: 'Perfil actualizado exitosamente', usuario: toApiUser(usuario) });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar perfil' });
    }
});

// ✅ REGISTRO
router.post('/register', async (req, res) => {
    try {
        const { nombre, email, password, gymId } = req.body;
        if (!nombre || !email || !password) {
            return res.status(400).json({ mensaje: 'Nombre, correo y contraseña son obligatorios' });
        }
        if (typeof password !== 'string' || password.length < 8) {
            return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres' });
        }
        // El registro público exige un gimnasio válido y activo (evita socios huérfanos).
        if (!gymId || !esIdValido(gymId)) {
            return res.status(400).json({ mensaje: 'Debes seleccionar un gimnasio válido' });
        }
        const gymValido = await prisma.gym.findFirst({ where: { id: gymId, activo: true }, select: { id: true } });
        if (!gymValido) {
            return res.status(400).json({ mensaje: 'El gimnasio no existe o no está activo' });
        }
        const emailNorm = email.toLowerCase().trim();
        const usuarioExiste = await prisma.user.findFirst({ where: { email: emailNorm, gymId: gymId || null }, select: { id: true } });
        if (usuarioExiste) return res.status(400).json({ mensaje: 'El correo ya está registrado en este gimnasio' });

        const salt = await bcrypt.genSalt(10);
        const passwordHasheada = await bcrypt.hash(password, salt);

        // El registro público SIEMPRE crea socios. Crear admins/entrenadores
        // debe hacerse por una ruta protegida (soloAdmin), nunca desde el body.
        const nuevoUsuario = await prisma.user.create({
            data: { gymId: gymId || null, nombre, email: emailNorm, password: passwordHasheada, role: 'socio' }
        });

        // Enviar correo de verificación (no bloquea el registro si falla el email).
        await enviarVerificacion(nuevoUsuario);
        res.status(201).json({ mensaje: 'Usuario creado con éxito. Revisa tu correo para verificar la cuenta.' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el servidor' });
    }
});

// ✅ VERIFICAR CORREO
router.post('/verify-email', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) return res.status(400).json({ mensaje: 'Token requerido' });

        const usuario = await prisma.user.findFirst({
            where: { verifyToken: hashToken(token), verifyTokenExpiry: { gt: new Date() } },
            omit: { password: false }
        });

        if (!usuario) return res.status(400).json({ mensaje: 'El enlace es inválido o ya expiró' });

        await prisma.user.update({
            where: { id: usuario.id },
            data: { emailVerified: true, verifyToken: null, verifyTokenExpiry: null }
        });

        res.json({ mensaje: 'Correo verificado correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al verificar el correo' });
    }
});

// ✅ REENVIAR VERIFICACIÓN (usuario autenticado)
router.post('/resend-verification', verificarToken, async (req, res) => {
    try {
        const usuario = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        if (usuario.emailVerified) return res.json({ mensaje: 'La cuenta ya está verificada' });

        await enviarVerificacion(usuario);
        res.json({ mensaje: 'Correo de verificación reenviado' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al reenviar la verificación' });
    }
});

// ✅ LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password, gymId } = req.body;
        // Superadmin no pertenece a ningún gym
        const emailNorm = (email || '').toLowerCase().trim();
        const esSuperAdmin = await prisma.user.findFirst({ where: { email: emailNorm, role: 'superadmin' }, select: { id: true } });
        const where = esSuperAdmin ? { email: emailNorm } : { email: emailNorm, gymId: gymId || null };
        const usuario = await prisma.user.findFirst({ where, omit: { password: false } });
        // Mensaje genérico idéntico para "usuario inexistente" y "contraseña incorrecta"
        // (evita enumeración de correos registrados por gimnasio).
        if (!usuario) return res.status(400).json({ mensaje: 'Credenciales inválidas' });

        const esValida = await bcrypt.compare(password, usuario.password);
        if (!esValida) return res.status(400).json({ mensaje: 'Credenciales inválidas' });

        const token = jwt.sign(
            { id: usuario.id, role: usuario.role, cargo: usuario.cargo || null, gymId: usuario.gymId || null },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.json({
            mensaje: 'Login exitoso',
            token,
            usuario: { _id: usuario.id, nombre: usuario.nombre, role: usuario.role, cargo: usuario.cargo || null, gymId: usuario.gymId || null }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el login' });
    }
});

// ✅ PERFIL DEL SOCIO
router.get('/perfil/:id', verificarToken, async (req, res) => {
    try {
        // El socio sólo puede ver su propio perfil; el admin, los de su gym.
        if (!esAdmin(req) && req.userId !== req.params.id) {
            return res.status(403).json({ mensaje: 'No autorizado para ver este perfil' });
        }
        const where = esAdmin(req)
            ? { id: req.params.id, gymId: req.gymId }
            : { id: req.params.id };
        const usuario = await prisma.user.findFirst({ where });
        if (!usuario) return res.status(404).json({ mensaje: 'Socio no encontrado' });

        let diasRestantes = 0;
        if (usuario.fechaVencimiento) {
            const hoy = new Date();
            const vencimiento = new Date(usuario.fechaVencimiento);
            diasRestantes = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
            if (diasRestantes < 0) diasRestantes = 0;
        }

        res.json({
            _id: usuario.id,
            nombre: usuario.nombre,
            fotoUrl: usuario.fotoUrl || '',
            email: usuario.email,
            mensajeMotivador: usuario.mensajeMotivador || 'HAZ QUE SUCEDA',
            datosPersonales: {
                identificacion: usuario.identificacion,
                fechaNacimiento: usuario.fechaNacimiento,
                sexo: usuario.sexo,
                pesoActual: usuario.pesoActual,
                altura: usuario.altura,
                telefono: usuario.telefono
            },
            cards: {
                vencimiento: diasRestantes,
                asistencias: usuario.asistenciasMes || 0
            },
            rol: usuario.role
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al cargar perfil' });
    }
});

// ✅ RENOVAR TOKEN (REFRESH)
router.post('/refresh-token', verificarToken, async (req, res) => {
    try {
        const usuario = await prisma.user.findUnique({ where: { id: req.userId } });
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // Generar nuevo token (misma expiración que el login: 8 horas)
        const nuevoToken = jwt.sign(
            { id: usuario.id, role: usuario.role, cargo: usuario.cargo || null, gymId: usuario.gymId || null },
            JWT_SECRET,
            { expiresIn: TOKEN_EXPIRY }
        );

        res.json({
            mensaje: 'Token renovado exitosamente',
            token: nuevoToken,
            usuario: {
                _id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                role: usuario.role,
                cargo: usuario.cargo || null,
                gymId: usuario.gymId || null
            }
        });
    } catch (error) {
        console.error('Error al renovar token:', error.message);
        res.status(500).json({ mensaje: 'Error al renovar token' });
    }
});

module.exports = router;
