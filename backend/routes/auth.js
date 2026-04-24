const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { verificarToken, soloAdmin } = require('../middleware/auth');

// ✅ OBTENER TODOS LOS USUARIOS (SOLO ADMINS)
router.get('/usuarios', verificarToken, soloAdmin, async (req, res) => {
    try {
        const usuarios = await User.find()
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
        const usuario = await User.findById(req.params.id);
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
        const usuario = await User.findById(req.params.id);
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
        const { nombre, email, password, role } = req.body;
        const usuarioExiste = await User.findOne({ email }).lean();
        if (usuarioExiste) return res.status(400).json({ mensaje: 'El correo ya está registrado' });

        const salt = await bcrypt.genSalt(10);
        const passwordHasheada = await bcrypt.hash(password, salt);

        const nuevoUsuario = new User({
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
        const { email, password } = req.body;
        const usuario = await User.findOne({ email }).lean();
        if (!usuario) return res.status(400).json({ mensaje: 'Usuario no encontrado' });

        const esValida = await bcrypt.compare(password, usuario.password);
        if (!esValida) return res.status(400).json({ mensaje: 'Contraseña incorrecta' });

        const token = jwt.sign(
            { id: usuario._id, role: usuario.role },
            process.env.JWT_SECRET || 'PALABRA_SECRETA',
            { expiresIn: '8h' }
        );

        res.json({
            mensaje: 'Login exitoso',
            token,
            usuario: { _id: usuario._id, nombre: usuario.nombre, role: usuario.role }
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

module.exports = router;
