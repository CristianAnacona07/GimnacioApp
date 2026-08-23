/**
 * Versión vigente de los documentos legales (Términos y Condiciones y
 * Política de Privacidad) que se muestran al activar una cuenta.
 *
 * Se guarda junto a la fecha en `User.terminosAceptadosEn` /
 * `User.terminosVersion` para poder demostrar después qué texto aceptó cada
 * persona y cuándo. **Si el texto cambia de forma sustancial hay que subir
 * este número** (y el gemelo en frontend/src/app/data/legal-textos.ts): así
 * queda constancia de que quien aceptó la v1 no aceptó la v2.
 */
const VERSION_LEGAL = '1.0';

module.exports = { VERSION_LEGAL };
