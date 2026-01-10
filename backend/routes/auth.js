const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const User = require('../models/user');

// Ruta de registro
router.post('/register', async (req, res) => {
    try {
        // CAMBIO: Usamos 'role' para que coincida con Angular
        const { nombre, email, password, role } = req.body;

        let usuarioExiste = await User.findOne({ email });
        if (usuarioExiste) {
            return res.status(400).json({ mensaje: 'El correo ya está registrado' });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHasheada = await bcrypt.hash(password, salt);

        const nuevoUsuario = new User({
            nombre,
            email,
            password: passwordHasheada,
            role: role || 'socio' // Aquí usamos role
        });

        await nuevoUsuario.save();
        res.status(201).json({ mensaje: 'Usuario creado con éxito' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el servidor', error: error.message });
    }
});

// Ruta de login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const usuario = await User.findOne({ email });
        if (!usuario) {
            return res.status(400).json({ mensaje: 'Usuario no encontrado' });
        }

        const esValida = await bcrypt.compare(password, usuario.password);
        if (!esValida) {
            return res.status(400).json({ mensaje: 'Contraseña incorrecta' });
        }

        // CAMBIO: Usar 'role' en el token y en la respuesta
        const token = jwt.sign(
            { id: usuario._id, role: usuario.role }, 
            'PALABRA_SECRETA', 
            { expiresIn: '8h' }
        );

        res.json({
            mensaje: 'Login exitoso',
            token,
            usuario: {
                _id: usuario._id,
                nombre: usuario.nombre,
                role: usuario.role // Consistencia con el frontend
            }
        });

    } catch (error) {
        res.status(500).json({ mensaje: 'Error en el login', error: error.message });
    }
});

// Ruta para obtener todos los usuarios (Solo para el Admin)
router.get('/usuarios', async (req, res) => {
    try {
        // Buscamos todos los usuarios, pero NO enviamos la contraseña por seguridad
        const usuarios = await User.find().select('-password'); 
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener los usuarios', error: error.message });
    }
});

// Ruta para renovar membresía
router.put('/renovar/:id', async (req, res) => {
    try {
        const { dias } = req.body;
        const usuario = await User.findById(req.params.id);

        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        // Si no tiene fecha anterior, usamos 'hoy'. Si tiene, comparamos.
        let base = (usuario.fechaVencimiento && usuario.fechaVencimiento > new Date()) 
                   ? usuario.fechaVencimiento 
                   : new Date();
        
        usuario.fechaVencimiento = new Date(base.getTime() + (dias * 24 * 60 * 60 * 1000));

        await usuario.save();
        res.json({ mensaje: 'Éxito', nuevaFecha: usuario.fechaVencimiento });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ruta para resetear o limpiar membresía
router.put('/limpiar-membresia/:id', async (req, res) => {
    try {
        const usuario = await User.findById(req.params.id);
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        usuario.fechaVencimiento = null; // Eliminamos la fecha para corregir el error
        await usuario.save();
        res.json({ mensaje: 'Membresía reseteada con éxito' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
module.exports = router;