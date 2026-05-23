const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/user');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// Configuración del transporter de email
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

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
    <p style="color:#475569;font-size:14px;margin:0 0 24px">Recibimos una solicitud para restablecer tu contraseña. El enlace expira en <strong>1 hora</strong>.</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${resetUrl}" style="background:#1d4ed8;color:#ffffff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
        Restablecer contraseña
      </a>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:20px 0 0">Si no solicitaste esto, ignora este correo.</p>
  </div>
</div>`;

// ✅ OLVIDÉ MI CONTRASEÑA
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const usuario = await User.findOne({ email: email.toLowerCase().trim() });
        if (!usuario) {
            return res.status(404).json({ mensaje: 'No existe una cuenta con ese correo' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        usuario.resetToken = token;
        usuario.resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora
        await usuario.save();

        const resetUrl = `${process.env.FRONTEND_URL || 'https://gimnacio-app.vercel.app'}/reset-password?token=${token}`;

        await transporter.sendMail({
            from: `"Kodiak Gym" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Recuperar contraseña — Kodiak Gym',
            html: emailTemplate(usuario.nombre, resetUrl)
        });

        res.json({ mensaje: 'Correo enviado. Revisa tu bandeja de entrada.' });
    } catch (error) {
        console.error('Error forgot-password:', error.message);
        res.status(500).json({ mensaje: 'Error al enviar el correo', error: error.message });
    }
});

// ✅ RESTABLECER CONTRASEÑA
router.post('/reset-password', async (req, res) => {
    try {
        const { token, nuevaPassword } = req.body;

        const usuario = await User.findOne({
            resetToken: token,
            resetTokenExpiry: { $gt: Date.now() }
        });

        if (!usuario) {
            return res.status(400).json({ mensaje: 'El enlace es inválido o ya expiró' });
        }

        const salt = await bcrypt.genSalt(10);
        usuario.password = await bcrypt.hash(nuevaPassword, salt);
        usuario.resetToken = null;
        usuario.resetTokenExpiry = null;
        await usuario.save();

        res.json({ mensaje: 'Contraseña actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al restablecer contraseña', error: error.message });
    }
});

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '976541861094-pcm89afbvhdi6fttf7si2cc7gbtuf2pn.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ✅ LOGIN CON GOOGLE
router.post('/google', async (req, res) => {
    try {
        const { credential, access_token } = req.body;

        let email, name, picture, sub;

        if (access_token) {
            const tempClient = new OAuth2Client(GOOGLE_CLIENT_ID);
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
                audience: GOOGLE_CLIENT_ID
            });
            ({ email, name, picture, sub } = ticket.getPayload());
        }

        let usuario = await User.findOne({ email: email.toLowerCase() });

        if (!usuario) {
            const salt = await bcrypt.genSalt(10);
            usuario = new User({
                nombre: name,
                email: email.toLowerCase(),
                password: await bcrypt.hash(sub + Date.now(), salt),
                role: 'socio',
                fotoUrl: picture || ''
            });
            await usuario.save();
        }

        const token = jwt.sign(
            { id: usuario._id, role: usuario.role, gymId: usuario.gymId || null },
            process.env.JWT_SECRET || 'PALABRA_SECRETA',
            { expiresIn: '30d' }
        );

        res.json({
            mensaje: 'Login con Google exitoso',
            token,
            usuario: { _id: usuario._id, nombre: usuario.nombre, role: usuario.role, gymId: usuario.gymId || null }
        });
    } catch (error) {
        console.error('Error Google auth:', error.message);
        res.status(401).json({ mensaje: 'Autenticación con Google fallida' });
    }
});

// ✅ OBTENER TODOS LOS USUARIOS (SOLO ADMINS)
router.get('/usuarios', verificarToken, soloAdmin, async (req, res) => {
    try {
        const usuarios = await User.find({ gymId: req.gymId })
            .select('-password')
            .sort({ createdAt: -1 })
            .lean();

        const usuariosConDatos = usuarios.map(usuario => {
            let diasRestantes = 0;
            if (usuario.fechaVencimiento) {
                const hoy = new Date();
                const vencimiento = new Date(usuario.fechaVencimiento);
                diasRestantes = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
                if (diasRestantes < 0) diasRestantes = 0;
            }
            return {
                ...usuario,
                diasRestantes,
                estadoMembresia: diasRestantes > 0 ? 'activo' : 'vencido'
            };
        });

        res.json(usuariosConDatos);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener usuarios', error: error.message });
    }
});

// ✅ RENOVAR MEMBRESÍA (SOLO ADMINS)
router.put('/renovar/:id', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { dias } = req.body;
        const usuario = await User.findOne({ _id: req.params.id, gymId: req.gymId });
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        const hoy = new Date();
        const fechaBase = usuario.fechaVencimiento && new Date(usuario.fechaVencimiento) > hoy
            ? new Date(usuario.fechaVencimiento)
            : hoy;

        fechaBase.setDate(fechaBase.getDate() + parseInt(dias));
        usuario.fechaVencimiento = fechaBase;
        await usuario.save();

        res.json({
            mensaje: 'Membresía renovada exitosamente',
            usuario: {
                _id: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email,
                role: usuario.role,
                fechaVencimiento: usuario.fechaVencimiento
            }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al renovar membresía', error: error.message });
    }
});

// ✅ LIMPIAR MEMBRESÍA (SOLO ADMINS)
router.put('/limpiar-membresia/:id', verificarToken, soloAdmin, async (req, res) => {
    try {
        const usuario = await User.findOne({ _id: req.params.id, gymId: req.gymId });
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        usuario.fechaVencimiento = undefined;
        await usuario.save();

        res.json({ mensaje: 'Membresía limpiada exitosamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al limpiar membresía', error: error.message });
    }
});

// ✅ ACTUALIZAR PERFIL (propio usuario o admin)
router.put('/actualizar-perfil/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const datosActualizados = req.body;

        if (req.userId !== id && req.userRole !== 'admin') {
            return res.status(403).json({ mensaje: 'No autorizado para actualizar este perfil' });
        }

        delete datosActualizados.password;
        delete datosActualizados.email;
        delete datosActualizados.role;

        const usuario = await User.findByIdAndUpdate(
            id,
            datosActualizados,
            { new: true, runValidators: true }
        ).select('-password');

        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        res.json({ mensaje: 'Perfil actualizado exitosamente', usuario });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar perfil', error: error.message });
    }
});

// ✅ REGISTRO
router.post('/register', async (req, res) => {
    try {
        const { nombre, email, password, role, gymId } = req.body;
        const usuarioExiste = await User.findOne({ email, gymId }).lean();
        if (usuarioExiste) return res.status(400).json({ mensaje: 'El correo ya está registrado en este gimnasio' });

        const salt = await bcrypt.genSalt(10);
        const passwordHasheada = await bcrypt.hash(password, salt);

        const nuevoUsuario = new User({
            gymId: gymId || null,
            nombre,
            email: email.toLowerCase().trim(),
            password: passwordHasheada,
            role: role || 'socio'
        });

        await nuevoUsuario.save();
        res.status(201).json({ mensaje: 'Usuario creado con éxito' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
    }
});

// ✅ LOGIN
router.post('/login', async (req, res) => {
    try {
        const { email, password, gymId } = req.body;
        // Superadmin no pertenece a ningún gym
        const esSuperAdmin = await User.findOne({ email, role: 'superadmin' }).lean();
        const query = esSuperAdmin ? { email } : { email, gymId: gymId || null };
        const usuario = await User.findOne(query).lean();
        if (!usuario) return res.status(400).json({ mensaje: 'Usuario no encontrado en este gimnasio' });

        const esValida = await bcrypt.compare(password, usuario.password);
        if (!esValida) return res.status(400).json({ mensaje: 'Contraseña incorrecta' });

        const token = jwt.sign(
            { id: usuario._id, role: usuario.role, gymId: usuario.gymId || null },
            process.env.JWT_SECRET || 'PALABRA_SECRETA',
            { expiresIn: '30d' }
        );

        res.json({
            mensaje: 'Login exitoso',
            token,
            usuario: { _id: usuario._id, nombre: usuario.nombre, role: usuario.role, gymId: usuario.gymId || null }
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el login', error: error.message });
    }
});

// ✅ PERFIL DEL SOCIO
router.get('/perfil/:id', verificarToken, async (req, res) => {
    try {
        const usuario = await User.findById(req.params.id).lean();
        if (!usuario) return res.status(404).json({ mensaje: 'Socio no encontrado' });

        const datosPersonales = usuario.datosPersonales || {
            identificacion: '',
            fechaNacimiento: '',
            sexo: '',
            pesoActual: 0,
            altura: 0,
            telefono: ''
        };

        let diasRestantes = 0;
        if (usuario.fechaVencimiento) {
            const hoy = new Date();
            const vencimiento = new Date(usuario.fechaVencimiento);
            diasRestantes = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
            if (diasRestantes < 0) diasRestantes = 0;
        }

        res.json({
            _id: usuario._id,
            nombre: usuario.nombre,
            fotoUrl: usuario.fotoUrl || '',
            email: usuario.email,
            mensajeMotivador: usuario.mensajeMotivador || 'HAZ QUE SUCEDA',
            datosPersonales,
            cards: {
                vencimiento: diasRestantes,
                asistencias: usuario.stats?.asistenciasMes || 0
            },
            rol: usuario.role
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al cargar perfil', error: error.message });
    }
});

// ✅ RENOVAR TOKEN (REFRESH)
router.post('/refresh-token', verificarToken, async (req, res) => {
    try {
        const usuario = await User.findById(req.userId).lean();
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // Generar nuevo token con 30 días de validez
        const nuevoToken = jwt.sign(
            { id: usuario._id, role: usuario.role, gymId: usuario.gymId || null },
            process.env.JWT_SECRET || 'PALABRA_SECRETA',
            { expiresIn: '30d' }
        );

        res.json({
            mensaje: 'Token renovado exitosamente',
            token: nuevoToken,
            usuario: {
                _id: usuario._id,
                nombre: usuario.nombre,
                email: usuario.email,
                role: usuario.role,
                gymId: usuario.gymId || null
            }
        });
    } catch (error) {
        console.error('Error al renovar token:', error.message);
        res.status(500).json({ mensaje: 'Error al renovar token', error: error.message });
    }
});

module.exports = router;
