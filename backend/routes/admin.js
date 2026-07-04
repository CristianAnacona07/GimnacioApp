const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const AuditLog = require('../models/auditlog');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

// Escapa un campo para CSV: si contiene coma, comilla doble o salto de línea,
// se envuelve en comillas dobles y se duplican las comillas internas.
function escaparCSV(valor) {
    if (valor === null || valor === undefined) return '';
    const str = String(valor);
    if (/[",\n\r]/.test(str)) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// Construye un CSV a partir de una cabecera (array) y filas (array de arrays).
function construirCSV(cabecera, filas) {
    const lineas = [];
    lineas.push(cabecera.map(escaparCSV).join(','));
    for (const fila of filas) {
        lineas.push(fila.map(escaparCSV).join(','));
    }
    return lineas.join('\n');
}

function fechaISO(valor) {
    if (!valor) return '';
    const d = new Date(valor);
    return isNaN(d.getTime()) ? '' : d.toISOString();
}

// GET /export/usuarios — exporta los usuarios del gimnasio como CSV.
router.get('/export/usuarios', verificarToken, soloAdmin, async (req, res) => {
    try {
        const usuarios = await User.find({ gymId: req.gymId })
            .select('nombre email role fechaRegistro fechaVencimiento')
            .lean();

        const cabecera = ['nombre', 'email', 'role', 'fechaRegistro', 'fechaVencimiento'];
        const filas = usuarios.map((u) => [
            u.nombre,
            u.email,
            u.role,
            fechaISO(u.fechaRegistro),
            fechaISO(u.fechaVencimiento)
        ]);

        const csv = construirCSV(cabecera, filas);

        await registrarAuditoria(req, 'EXPORTAR_USUARIOS', {
            recurso: 'User',
            detalle: { total: usuarios.length }
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="usuarios.csv"');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /export/transacciones — exporta las transacciones del gimnasio como CSV.
// Si el modelo de transacciones no existe, responde 404.
router.get('/export/transacciones', verificarToken, soloAdmin, async (req, res) => {
    let Transaccion;
    try {
        Transaccion = require('../models/transaccion');
    } catch {
        return res.status(404).json({ error: 'Transacciones no disponibles' });
    }

    try {
        const transacciones = await Transaccion.find({ gymId: req.gymId })
            .select('usuarioId monto concepto fecha')
            .populate('usuarioId', 'nombre email')
            .lean();

        const cabecera = ['usuario', 'monto', 'concepto', 'fecha'];
        const filas = transacciones.map((t) => {
            const usuario = t.usuarioId
                ? (t.usuarioId.nombre || t.usuarioId.email || String(t.usuarioId))
                : '';
            return [usuario, t.monto, t.concepto, fechaISO(t.fecha)];
        });

        const csv = construirCSV(cabecera, filas);

        await registrarAuditoria(req, 'EXPORTAR_TRANSACCIONES', {
            recurso: 'Transaccion',
            detalle: { total: transacciones.length }
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="transacciones.csv"');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// POST /import/usuarios — importa socios desde un CSV en el cuerpo { csv }.
// Cabecera obligatoria con al menos 'nombre,email' (opcional 'fechaVencimiento').
// División simple por líneas/comas (MVP: no admite comas entrecomilladas).
router.post('/import/usuarios', verificarToken, soloAdmin, async (req, res) => {
    try {
        const { csv } = req.body;

        if (typeof csv !== 'string' || csv.trim() === '') {
            return res.status(400).json({ error: 'El campo csv es obligatorio' });
        }

        // Normaliza saltos de línea y descarta líneas vacías.
        const lineas = csv
            .split(/\r\n|\r|\n/)
            .map((l) => l.trim())
            .filter((l) => l.length > 0);

        if (lineas.length < 1) {
            return res.status(400).json({ error: 'CSV vacío o sin datos' });
        }

        const cabecera = lineas[0].split(',').map((c) => c.trim().toLowerCase());
        const idxNombre = cabecera.indexOf('nombre');
        const idxEmail = cabecera.indexOf('email');
        const idxVencimiento = cabecera.indexOf('fechavencimiento');

        if (idxNombre === -1 || idxEmail === -1) {
            return res.status(400).json({ error: "La cabecera debe incluir al menos 'nombre,email'" });
        }

        let creados = 0;
        let omitidos = 0;
        const errores = [];

        for (let i = 1; i < lineas.length; i++) {
            const numeroFila = i + 1;
            const campos = lineas[i].split(',').map((c) => c.trim());

            const nombre = campos[idxNombre];
            const email = campos[idxEmail] ? campos[idxEmail].toLowerCase() : '';

            // Fila malformada: falta nombre o email.
            if (!nombre || !email) {
                errores.push({ fila: numeroFila, error: 'Faltan campos obligatorios (nombre/email)' });
                continue;
            }

            try {
                // Omitir si el email ya existe en este gimnasio.
                const existe = await User.findOne({ email, gymId: req.gymId }).lean();
                if (existe) {
                    omitidos++;
                    continue;
                }

                // Contraseña temporal aleatoria (el socio la restablecerá).
                const tempPassword = crypto.randomBytes(24).toString('hex');
                const salt = await bcrypt.genSalt(10);
                const passwordHash = await bcrypt.hash(tempPassword, salt);

                const datos = {
                    gymId: req.gymId,
                    nombre,
                    email,
                    password: passwordHash,
                    role: 'socio',
                    emailVerified: false
                };

                if (idxVencimiento !== -1 && campos[idxVencimiento]) {
                    const venc = new Date(campos[idxVencimiento]);
                    if (!isNaN(venc.getTime())) {
                        datos.fechaVencimiento = venc;
                    }
                }

                await User.create(datos);
                creados++;
            } catch (err) {
                errores.push({ fila: numeroFila, error: err.message });
            }
        }

        await registrarAuditoria(req, 'IMPORTAR_USUARIOS', {
            recurso: 'User',
            detalle: { creados, omitidos, errores: errores.length }
        });

        res.json({ creados, omitidos, errores });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

// GET /audit — lista la auditoría del gimnasio, más reciente primero (paginación opcional).
router.get('/audit', verificarToken, soloAdmin, async (req, res) => {
    try {
        const filtro = { gymId: req.gymId };
        const paginar = req.query.page !== undefined;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

        let q = AuditLog.find(filtro).sort({ createdAt: -1 });
        if (paginar) q = q.skip((page - 1) * limit).limit(limit);
        const items = await q.lean();

        if (paginar) {
            const total = await AuditLog.countDocuments(filtro);
            return res.json({ data: items, total, page, limit, pages: Math.ceil(total / limit) });
        }
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;
