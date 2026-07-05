/**
 * Envío de mensajes de WhatsApp (recibo de asistencia/pago).
 *
 * Modo AUTOMÁTICO (Meta WhatsApp Cloud API): requiere configurar por env:
 *   WHATSAPP_TOKEN        → token permanente de la app de Meta
 *   WHATSAPP_PHONE_ID     → ID del número de WhatsApp Business
 *   WHATSAPP_TEMPLATE     → nombre de la plantilla aprobada (business-initiated)
 *   WHATSAPP_LANG         → código de idioma de la plantilla (ej: es, es_CO)
 *
 * IMPORTANTE: Meta exige una PLANTILLA APROBADA para mensajes iniciados por el
 * negocio (como un recibo). La plantilla se crea una vez en WhatsApp Business
 * Manager. Los parámetros van en orden a las variables {{1}}, {{2}}, ... de la
 * plantilla. Mientras no esté configurado/aprobado, usar el link wa.me (fallback).
 */

const API_VERSION = 'v20.0';

function estaConfigurado() {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TEMPLATE);
}

// Normaliza a solo dígitos con código de país (WhatsApp los exige así).
function normalizarTelefono(telefono) {
  return String(telefono || '').replace(/\D/g, '');
}

/**
 * Envía el recibo por plantilla. `parametros` es un array de strings que llenan
 * las variables de la plantilla en orden. Nunca lanza: devuelve {enviado, motivo}.
 */
async function enviarRecibo(telefono, parametros = []) {
  const to = normalizarTelefono(telefono);
  if (!to) return { enviado: false, motivo: 'sin_telefono' };
  if (!estaConfigurado()) return { enviado: false, motivo: 'no_configurado' };

  try {
    const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_ID}/messages`;
    const body = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: process.env.WHATSAPP_TEMPLATE,
        language: { code: process.env.WHATSAPP_LANG || 'es' },
        components: [
          { type: 'body', parameters: parametros.map(p => ({ type: 'text', text: String(p) })) },
        ],
      },
    };
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const detalle = await resp.text().catch(() => '');
      console.error('WhatsApp API error:', resp.status, detalle.slice(0, 300));
      return { enviado: false, motivo: `api_error_${resp.status}` };
    }
    return { enviado: true };
  } catch (err) {
    console.error('WhatsApp envío falló:', err.message);
    return { enviado: false, motivo: 'excepcion' };
  }
}

/**
 * Link wa.me con el mensaje pre-escrito (fallback manual: recepción pulsa enviar).
 * Funciona siempre, sin configuración ni costo.
 */
function linkWhatsApp(telefono, texto) {
  const to = normalizarTelefono(telefono);
  if (!to) return null;
  return `https://wa.me/${to}?text=${encodeURIComponent(texto)}`;
}

module.exports = { enviarRecibo, linkWhatsApp, estaConfigurado };
