const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/user');
const { verificarToken } = require('../middleware/auth');
const { registrarAuditoria } = require('../helpers/audit');

/*
 * Doble factor de autenticación (2FA) mediante TOTP.
 *
 * Implementación estándar RFC 6238 (TOTP) sobre RFC 4226 (HOTP), usando
 * únicamente el módulo 'crypto' de Node (sin dependencias externas):
 *   - HMAC-SHA1 sobre un contador de pasos de 30 segundos.
 *   - Truncamiento dinámico para obtener un código de 6 dígitos.
 * El secreto se comparte con el cliente en base32 (RFC 4648) para que
 * apps como Google Authenticator / Authy lo importen vía otpauth://.
 */

// ── Alfabeto base32 (RFC 4648, sin padding) ──────────────────────────────
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Codifica un Buffer a base32 (mayúsculas, sin '=' de relleno).
function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}

// Decodifica una cadena base32 (ignora padding/minúsculas) de vuelta a Buffer.
function base32Decode(str) {
    const clean = String(str || '').toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (let i = 0; i < clean.length; i++) {
        const idx = BASE32_ALPHABET.indexOf(clean[i]);
        if (idx === -1) continue; // carácter inválido: se ignora
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}

// Genera un código TOTP de `digits` dígitos para el instante `t` (ms).
function totp(secretBuf, timeStep = 30, digits = 6, t = Date.now()) {
    const counter = Math.floor((t / 1000) / timeStep);

    // Contador de 8 bytes big-endian.
    const counterBuf = Buffer.alloc(8);
    // Usamos aritmética de enteros seguros; los 4 bytes altos serían 0
    // durante siglos, así que escribimos el valor en los 32 bits bajos.
    counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuf.writeUInt32BE(counter >>> 0, 4);

    const hmac = crypto.createHmac('sha1', secretBuf).update(counterBuf).digest();

    // Truncamiento dinámico (RFC 6238 / RFC 4226).
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binCode =
        ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);

    const code = binCode % Math.pow(10, digits);
    return String(code).padStart(digits, '0');
}

// Verifica un código aceptando el paso actual y ±1 paso (tolerancia de reloj).
function verify(secretBuf, code) {
    if (!secretBuf || !secretBuf.length) return false;
    const clean = String(code || '').trim();
    if (!/^\d{6}$/.test(clean)) return false;
    const now = Date.now();
    for (let w = -1; w <= 1; w++) {
        const candidate = totp(secretBuf, 30, 6, now + w * 30 * 1000);
        // Comparación en tiempo constante para evitar ataques de temporización.
        if (
            candidate.length === clean.length &&
            crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(clean))
        ) {
            return true;
        }
    }
    return false;
}

// Hash SHA-256 en hex para almacenar los códigos de respaldo.
function hashBackup(codePlano) {
    return crypto.createHash('sha256').update(codePlano).digest('hex');
}

// ── POST /api/2fa/setup ──────────────────────────────────────────────────
// Genera y guarda un secreto (enabled sigue en false hasta confirmar).
router.post('/setup', verificarToken, async (req, res) => {
    try {
        const usuario = await User.findById(req.userId).select('email').lean();
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });

        const secret = base32Encode(crypto.randomBytes(20));

        await User.updateOne(
            { _id: req.userId },
            { $set: { 'twoFactor.secret': secret, 'twoFactor.enabled': false } }
        );

        const email = usuario.email || '';
        const otpauth =
            'otpauth://totp/KodiakGym:' + email + '?secret=' + secret + '&issuer=KodiakGym';

        res.json({ secret, otpauth });
    } catch (err) {
        res.status(500).json({ mensaje: 'Error al iniciar la configuración de 2FA' });
    }
});

// ── POST /api/2fa/enable ─────────────────────────────────────────────────
// Confirma el código, activa 2FA y entrega 8 códigos de respaldo (una vez).
router.post('/enable', verificarToken, async (req, res) => {
    try {
        const { code } = req.body;

        const usuario = await User.findById(req.userId).select('+twoFactor.secret');
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        if (!usuario.twoFactor || !usuario.twoFactor.secret) {
            return res.status(400).json({ mensaje: 'Debes iniciar la configuración primero' });
        }

        const secretBuf = base32Decode(usuario.twoFactor.secret);
        if (!verify(secretBuf, code)) {
            return res.status(401).json({ mensaje: 'Código inválido' });
        }

        // Genera 8 códigos de respaldo en claro; se guardan sólo hasheados.
        const backupPlanos = [];
        const backupHashes = [];
        for (let i = 0; i < 8; i++) {
            const plano = crypto.randomBytes(5).toString('hex'); // 10 hex chars
            backupPlanos.push(plano);
            backupHashes.push(hashBackup(plano));
        }

        usuario.twoFactor.enabled = true;
        usuario.twoFactor.backupCodes = backupHashes;
        await usuario.save();

        await registrarAuditoria(req, 'ACTIVAR_2FA', {
            recurso: 'User',
            recursoId: req.userId
        });

        res.json({ ok: true, backupCodes: backupPlanos });
    } catch (err) {
        res.status(500).json({ mensaje: 'Error al activar 2FA' });
    }
});

// ── POST /api/2fa/disable ────────────────────────────────────────────────
// Verifica el código y desactiva 2FA, borrando secreto y códigos de respaldo.
router.post('/disable', verificarToken, async (req, res) => {
    try {
        const { code } = req.body;

        const usuario = await User.findById(req.userId).select('+twoFactor.secret');
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        if (!usuario.twoFactor || !usuario.twoFactor.enabled || !usuario.twoFactor.secret) {
            return res.status(400).json({ mensaje: 'El 2FA no está activo' });
        }

        const secretBuf = base32Decode(usuario.twoFactor.secret);
        if (!verify(secretBuf, code)) {
            return res.status(401).json({ mensaje: 'Código inválido' });
        }

        usuario.twoFactor.enabled = false;
        usuario.twoFactor.secret = null;
        usuario.twoFactor.backupCodes = [];
        await usuario.save();

        await registrarAuditoria(req, 'DESACTIVAR_2FA', {
            recurso: 'User',
            recursoId: req.userId
        });

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ mensaje: 'Error al desactivar 2FA' });
    }
});

// ── POST /api/2fa/verify (PÚBLICO) ───────────────────────────────────────
// Paso de verificación durante el login (step-up). Acepta código TOTP o
// consume un código de respaldo. No requiere token porque el usuario aún
// no ha completado la autenticación.
router.post('/verify', async (req, res) => {
    try {
        const { userId, code } = req.body;
        if (!userId || !code) {
            return res.status(400).json({ mensaje: 'Faltan datos' });
        }

        const usuario = await User.findById(userId).select('+twoFactor.secret +twoFactor.backupCodes');
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        if (!usuario.twoFactor || !usuario.twoFactor.enabled) {
            return res.status(400).json({ mensaje: 'El 2FA no está activo para este usuario' });
        }

        // 1) Intento como código TOTP.
        const secretBuf = base32Decode(usuario.twoFactor.secret || '');
        if (verify(secretBuf, code)) {
            return res.json({ ok: true });
        }

        // 2) Intento como código de respaldo (de un solo uso).
        const hash = hashBackup(String(code || '').trim());
        const codigos = usuario.twoFactor.backupCodes || [];
        const idx = codigos.indexOf(hash);
        if (idx !== -1) {
            codigos.splice(idx, 1); // consumido: no se puede reutilizar
            usuario.twoFactor.backupCodes = codigos;
            await usuario.save();
            return res.json({ ok: true });
        }

        return res.status(401).json({ mensaje: 'Código inválido' });
    } catch (err) {
        res.status(500).json({ mensaje: 'Error al verificar 2FA' });
    }
});

module.exports = router;
