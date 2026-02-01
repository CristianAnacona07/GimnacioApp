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

// ✅ MIDDLEWARE DE AUTENTICACIÓN
const verificarToken = (req, res, next) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ mensaje: 'Token no proporcionado' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'PALABRA_SECRETA');
        req.userId = decoded.id;
        req.userRole = decoded.role;
        next();
    } catch (error) {
        return res.status(401).json({ mensaje: 'Token inválido o expirado' });
    }
};

// ✅ OBTENER TODOS LOS USUARIOS (SOLO ADMINS)
router.get('/usuarios', verificarToken, async (req, res) => {
    try {
        // Verificar que sea admin
        if (req.userRole !== 'admin') {
            return res.status(403).json({ mensaje: 'Acceso denegado. Solo administradores.' });
        }

        const usuarios = await User.find()
            .select('-password') // Excluir contraseña por seguridad
            .sort({ createdAt: -1 }) // Más recientes primero
            .lean(); // Mejor performance

        // Calcular días restantes para cada usuario
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
        console.error('❌ Error al obtener usuarios:', error);
        res.status(500).json({ mensaje: 'Error al obtener usuarios', error: error.message });
    }
});

// ✅ RENOVAR MEMBRESÍA (SOLO ADMINS)
router.put('/renovar/:id', verificarToken, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ mensaje: 'Acceso denegado' });
        }

        const { dias } = req.body;
        const usuario = await User.findById(req.params.id);
        
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // Calcular nueva fecha de vencimiento
        const hoy = new Date();
        const fechaBase = usuario.fechaVencimiento && new Date(usuario.fechaVencimiento) > hoy 
            ? new Date(usuario.fechaVencimiento) 
            : hoy;
        
        fechaBase.setDate(fechaBase.getDate() + parseInt(dias));
        usuario.fechaVencimiento = fechaBase;
        
        await usuario.save();

        // Invalidar caché
        invalidarCacheSocio(req, usuario._id.toString());

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
        console.error('❌ Error al renovar membresía:', error);
        res.status(500).json({ mensaje: 'Error al renovar membresía', error: error.message });
    }
});

// ✅ LIMPIAR MEMBRESÍA (SOLO ADMINS)
router.put('/limpiar-membresia/:id', verificarToken, async (req, res) => {
    try {
        if (req.userRole !== 'admin') {
            return res.status(403).json({ mensaje: 'Acceso denegado' });
        }

        const usuario = await User.findById(req.params.id);
        
        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        usuario.fechaVencimiento = undefined;
        await usuario.save();

        invalidarCacheSocio(req, usuario._id.toString());

        res.json({ mensaje: 'Membresía limpiada exitosamente' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al limpiar membresía', error: error.message });
    }
});

// ✅ ACTUALIZAR PERFIL
router.put('/actualizar-perfil/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const datosActualizados = req.body;

        // Validación de permisos
        if (req.userId !== id && req.userRole !== 'admin') {
            return res.status(403).json({ mensaje: 'No autorizado para actualizar este perfil' });
        }

        // Limpieza de datos sensibles
        delete datosActualizados.password;
        delete datosActualizados.email;
        delete datosActualizados.role;

        const usuario = await User.findByIdAndUpdate(
            id, 
            datosActualizados, 
            { new: true, runValidators: true }
        ).select('-password');

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        // Quitamos la llamada a invalidarCacheSocio porque ya no usamos caché
        res.json({ 
            mensaje: 'Perfil actualizado exitosamente',
            usuario 
        });
    } catch (error) {
        console.error('❌ Error al actualizar perfil:', error);
        res.status(500).json({ mensaje: 'Error al actualizar perfil', error: error.message });
    }
});

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

        // ✅ Asegurar que datosPersonales existe con valores por defecto
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
            datosPersonales: datosPersonales, // ✅ Incluir datosPersonales
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