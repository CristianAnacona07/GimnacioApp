const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { getPrismaClient } = require('../prisma/client');
const { verificarToken, soloAdmin } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');
const { paginar } = require('../lib/pagination');

const prisma = getPrismaClient();

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
        const usuarios = await prisma.user.findMany({
            where: { gymId: req.gymId },
            select: {
                nombre: true, email: true, role: true, fechaRegistro: true, fechaVencimiento: true,
                terminosAceptadosEn: true, terminosVersion: true
            }
        });

        // Las dos últimas columnas son la constancia legal (cuándo aceptó cada
        // socio los Términos y la Política de Privacidad, y qué versión del
        // texto): van en el respaldo para que el gimnasio pueda demostrarlo
        // sin depender de la base de datos. Vacías = cuentas anteriores a que
        // existiera la aceptación.
        const cabecera = [
            'nombre', 'email', 'role', 'fechaRegistro', 'fechaVencimiento',
            'terminosAceptadosEn', 'terminosVersion'
        ];
        const filas = usuarios.map((u) => [
            u.nombre,
            u.email,
            u.role,
            fechaISO(u.fechaRegistro),
            fechaISO(u.fechaVencimiento),
            fechaISO(u.terminosAceptadosEn),
            u.terminosVersion || ''
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
router.get('/export/transacciones', verificarToken, soloAdmin, async (req, res) => {
    try {
        const transacciones = await prisma.transaccion.findMany({
            where: { gymId: req.gymId },
            select: { monto: true, concepto: true, fecha: true, usuario: { select: { nombre: true, email: true } } }
        });

        const cabecera = ['usuario', 'monto', 'concepto', 'fecha'];
        const filas = transacciones.map((t) => {
            const usuario = t.usuario ? (t.usuario.nombre || t.usuario.email || '') : '';
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
                const existe = await prisma.user.findFirst({ where: { email, gymId: req.gymId }, select: { id: true } });
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

                await prisma.user.create({ data: datos });
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
        const resultado = await paginar(req, prisma.auditLog, {
            where: { gymId: req.gymId },
            orderBy: { createdAt: 'desc' }
        });
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor' });
    }
});

module.exports = router;

// Exposición de los helpers puros (CSV/fechas) para pruebas unitarias.
// No altera el comportamiento del router (solo añade propiedades al objeto exportado).
module.exports.escaparCSV = escaparCSV;
module.exports.construirCSV = construirCSV;
module.exports.fechaISO = fechaISO;
