const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const User = require('../models/user');

// --- UTILIDAD DE CACHÉ ---
const invalidarCacheSocio = (req, userId) => {
    const clearCache = req.app.get('clearUserCache');
    if (clearCache && userId) clearCache(userId);
};

// Registro
router.post('/register', async (req, res) => {
    try {
        const { nombre, email, password, role } = req.body;
        let usuarioExiste = await User.findOne({ email }).lean();
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

// Login
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

// Perfil del socio
router.get('/perfil/:id', async (req, res) => {
    try {
        const usuario = await User.findById(req.params.id).lean();
        if (!usuario) return res.status(404).json({ mensaje: 'Socio no encontrado' });

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
            fotoUrl: usuario.fotoUrl,
            email: usuario.email,
            cards: { vencimiento: diasRestantes, asistencias: usuario.stats?.asistenciasMes || 0 },
            rol: usuario.role
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al cargar perfil', error: error.message });
    }
});

module.exports = router;