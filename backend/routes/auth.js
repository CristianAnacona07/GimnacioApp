const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const User = require('../models/user');

// --- UTILIDAD DE CACHÉ ---
// Función para limpiar el caché del usuario específico cuando hay cambios
const invalidarCacheSocio = (req, userId) => {
    const clearCache = req.app.get('clearUserCache');
    if (clearCache && userId) clearCache(userId);
};

// 1. Registro (Sin cambios mayores, solo consistencia)
router.post('/register', async (req, res) => {
    try {
        const { nombre, email, password, role } = req.body;
        let usuarioExiste = await User.findOne({ email }).lean(); // .lean() para rapidez
        
        if (usuarioExiste) {
            return res.status(400).json({ mensaje: 'El correo ya está registrado' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHasheada = await bcrypt.hash(password, salt);

        const nuevoUsuario = new User({
            nombre, email, password: passwordHasheada,
            role: role || 'socio'
        });

        await nuevoUsuario.save();
        res.status(201).json({ mensaje: 'Usuario creado con éxito' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
    }
});

// 2. Login (Optimizado con .lean() para respuesta inmediata)
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

// 3. Obtener todos los usuarios (Cacheable en index.js)
router.get('/usuarios', async (req, res) => {
    try {
        const usuarios = await User.find()
            .select('-password')
            .sort({ nombre: 1 })
            .lean(); // Vital para el sistema de caché
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener usuarios', error: error.message });
    }
});

// 4. Perfil del socio (Procesado y veloz)
router.get('/perfil/:id', async (req, res) => {
    try {
        const usuario = await User.findById(req.params.id).lean(); // .lean() reduce carga de CPU
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

// 5. Actualizar Perfil (Limpia el caché para ver cambios al instante)
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

        // 🔥 Invalidar caché del socio para que cargue los nuevos datos
        invalidarCacheSocio(req, req.params.id);

        res.json({ mensaje: 'Perfil actualizado', usuario });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar', error: error.message });
    }
});

// 6. Renovar Membresía (Limpia caché)
router.put('/renovar/:id', async (req, res) => {
    try {
        const { dias } = req.body;
        const usuario = await User.findById(req.params.id);
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        let base = (usuario.fechaVencimiento && usuario.fechaVencimiento > new Date()) 
                   ? usuario.fechaVencimiento : new Date();
        
        usuario.fechaVencimiento = new Date(base.getTime() + (dias * 24 * 60 * 60 * 1000));
        await usuario.save();

        // 🔥 Invalidar caché
        invalidarCacheSocio(req, req.params.id);

        res.json({ mensaje: 'Éxito', nuevaFecha: usuario.fechaVencimiento });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;