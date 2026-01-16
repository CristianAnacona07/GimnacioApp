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

//obtener datos para perfil del socio
// OBTENER DATOS PROCESADOS PARA EL PERFIL DEL SOCIO
router.get('/perfil/:id', async (req, res) => {
    try {
        const usuario = await User.findById(req.params.id);
        if (!usuario) return res.status(404).json({ mensaje: 'Socio no encontrado' });

        // LÓGICA DE VENCIMIENTO (El "12" de tu card)
        let diasRestantes = 0;
        if (usuario.fechaVencimiento) {
            const hoy = new Date();
            const vencimiento = new Date(usuario.fechaVencimiento);
            const diferencia = vencimiento.getTime() - hoy.getTime();
            diasRestantes = Math.ceil(diferencia / (1000 * 60 * 60 * 24));
            if (diasRestantes < 0) diasRestantes = 0; // Si ya venció
        }

        // Respuesta optimizada para tu diseño de Angular
        res.json({
            _id: usuario._id,
            nombre: usuario.nombre,
            fotoUrl: usuario.fotoUrl,
            email: usuario.email,
            mensajeMotivador: usuario.mensajeMotivador,
            cards: {
                vencimiento: diasRestantes,
                asistencias: usuario.stats.asistenciasMes,
                racha: usuario.stats.racha
            },
            datosPersonales: usuario.datosPersonales,
            rol: usuario.role
        });

    } catch (error) {
        res.status(500).json({ mensaje: 'Error al cargar perfil', error: error.message });
    }
});
// ACTUALIZAR DATOS PERSONALES
router.put('/actualizar-perfil/:id', async (req, res) => {
    try {
        console.log("Cuerpo recibido:", req.body); // Esto te dirá qué llega de Angular

        // Extraemos los datos. Nota que sacamos datosPersonales completo
        const { nombre, mensajeMotivador, fotoUrl, datosPersonales } = req.body;
        
        const usuario = await User.findByIdAndUpdate(
            req.params.id,
            { 
                $set: {
                    nombre, 
                    mensajeMotivador,
                    fotoUrl,
                    // Usamos notación de punto para actualizar sub-objetos sin borrar el resto
                    "datosPersonales.identificacion": datosPersonales?.identificacion,
                    "datosPersonales.fechaNacimiento": datosPersonales?.fechaNacimiento,
                    "datosPersonales.sexo": datosPersonales?.sexo,
                    "datosPersonales.pesoActual": datosPersonales?.pesoActual,
                    "datosPersonales.altura": datosPersonales?.altura,
                    "datosPersonales.telefono": datosPersonales?.telefono

                }
            },
            { new: true, runValidators: true }
        );

        if (!usuario) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }

        res.json({ mensaje: 'Perfil actualizado', usuario });
    } catch (error) {
        console.error("Error en el PUT:", error);
        res.status(500).json({ mensaje: 'Error al actualizar', error: error.message });
    }
});
module.exports = router;