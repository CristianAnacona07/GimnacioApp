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

// 1. Registro
router.post('/register', async (req, res) => {
    try {
        const { nombre, email, password, role } = req.body;
        let usuarioExiste = await User.findOne({ email }).lean();
        
        if (usuarioExiste) {
            return res.status(400).json({ mensaje: 'El correo ya está registrado' });
        }

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

// 2. Login - OPTIMIZADO CON LOGS DE DIAGNÓSTICO
router.post('/login', async (req, res) => {
    console.time('⏱️ Login Total');
    
    try {
        const { email, password } = req.body;
        
        console.time('🔍 DB Query');
        const usuario = await User.findOne({ email: email.toLowerCase().trim() }).lean(); 
        console.timeEnd('🔍 DB Query');
        
        if (!usuario) {
            console.timeEnd('⏱️ Login Total');
            return res.status(400).json({ mensaje: 'Usuario no encontrado' });
        }

        console.time('🔐 Password Check');
        const esValida = await bcrypt.compare(password, usuario.password);
        console.timeEnd('🔐 Password Check');
        
        if (!esValida) {
            console.timeEnd('⏱️ Login Total');
            return res.status(400).json({ mensaje: 'Contraseña incorrecta' });
        }

        console.time('🎫 JWT Sign');
        const token = jwt.sign(
            { id: usuario._id, role: usuario.role }, 
            process.env.JWT_SECRET || 'PALABRA_SECRETA', 
            { expiresIn: '8h' }
        );
        console.timeEnd('🎫 JWT Sign');

        console.timeEnd('⏱️ Login Total');
        console.log(`✅ Login exitoso para: ${email}`);

        res.json({
            mensaje: 'Login exitoso',
            token,
            usuario: { 
                _id: usuario._id, 
                nombre: usuario.nombre, 
                email: usuario.email,
                role: usuario.role 
            }
        });
    } catch (error) {
        console.timeEnd('⏱️ Login Total');
        console.error('❌ Error en login:', error);
        res.status(500).json({ mensaje: 'Error en el login', error: error.message });
    }
});

// 3. Obtener todos los usuarios
router.get('/usuarios', async (req, res) => {
    try {
        const usuarios = await User.find()
            .select('-password')
            .sort({ nombre: 1 })
            .lean();
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener usuarios', error: error.message });
    }
});

// 4. Perfil del socio
router.get('/perfil/:id', async (req, res) => {
    try {
        const usuario = await User.findById(req.params.id).lean();
        if (!usuario) return res.status(404).json({ mensaje: 'Socio no encontrado' });

        let diasRestantes = 0;
        if (usuario.fechaVencimiento) {
            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);
            const vencimiento = new Date(usuario.fechaVencimiento);
            vencimiento.setHours(0, 0, 0, 0);
            diasRestantes = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
            if (diasRestantes < 0) diasRestantes = 0;
        }

        res.json({
            _id: usuario._id,
            nombre: usuario.nombre,
            fotoUrl: usuario.fotoUrl,
            email: usuario.email,
            mensajeMotivador: usuario.mensajeMotivador,
            cards: {
                vencimiento: diasRestantes,
                asistencias: usuario.stats?.asistenciasMes || 0,
                racha: usuario.stats?.racha || 0
            },
            datosPersonales: usuario.datosPersonales,
            rol: usuario.role
        });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al cargar perfil', error: error.message });
    }
});

// 5. Actualizar Perfil
router.put('/actualizar-perfil/:id', async (req, res) => {
    try {
        const { nombre, mensajeMotivador, fotoUrl, datosPersonales } = req.body;
        
        const usuario = await User.findByIdAndUpdate(
            req.params.id,
            { 
                $set: {
                    nombre, mensajeMotivador, fotoUrl,
                    "datosPersonales.identificacion": datosPersonales?.identificacion,
                    "datosPersonales.fechaNacimiento": datosPersonales?.fechaNacimiento,
                    "datosPersonales.sexo": datosPersonales?.sexo,
                    "datosPersonales.pesoActual": datosPersonales?.pesoActual,
                    "datosPersonales.altura": datosPersonales?.altura,
                    "datosPersonales.telefono": datosPersonales?.telefono
                }
            },
            { new: true, runValidators: true }
        ).lean();

        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        invalidarCacheSocio(req, req.params.id);

        res.json({ mensaje: 'Perfil actualizado', usuario });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar', error: error.message });
    }
});

// 6. Renovar Membresía
router.put('/renovar/:id', async (req, res) => {
    try {
        const { dias } = req.body;
        const usuario = await User.findById(req.params.id);
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        let base = (usuario.fechaVencimiento && usuario.fechaVencimiento > new Date()) 
                   ? usuario.fechaVencimiento : new Date();
        
        usuario.fechaVencimiento = new Date(base.getTime() + (dias * 24 * 60 * 60 * 1000));
        await usuario.save();

        invalidarCacheSocio(req, req.params.id);

        res.json({ mensaje: 'Éxito', nuevaFecha: usuario.fechaVencimiento });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;