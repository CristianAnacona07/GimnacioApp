const nodemailer = require('nodemailer');

/**
 * Envío de correo de la plataforma.
 *
 * El transporter vive aquí para que auth.js y gym.js compartan una única
 * configuración. Si no hay forma de enviar no se envía nada: las funciones
 * devuelven false en vez de lanzar, porque un correo que no sale nunca debe
 * tumbar la operación de negocio que sí tuvo éxito.
 *
 * Dos modos:
 *  - SMTP genérico, si está definido SMTP_HOST. Es el que se usa en desarrollo
 *    con Mailpit (`SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`), que captura los
 *    correos en una bandeja web en vez de entregarlos a nadie. Sin auth: si
 *    SMTP_USER está vacío no se manda ninguna credencial.
 *  - Gmail, si no hay SMTP_HOST pero sí EMAIL_USER/EMAIL_PASS. Es producción.
 */
const usaSmtpPropio = () => !!process.env.SMTP_HOST;

const construirTransporter = () => {
  if (usaSmtpPropio()) {
    const puerto = Number(process.env.SMTP_PORT) || 1025;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      // Mailpit y demás capturadores locales hablan SMTP en claro.
      secure: process.env.SMTP_SECURE === 'true',
      ignoreTLS: process.env.SMTP_SECURE !== 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const transporter = construirTransporter();

const emailConfigurado = () => usaSmtpPropio() || !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

// Remitente único para todos los correos. Con Mailpit no hay cuenta de Gmail,
// así que se usa una dirección de relleno: el buzón local acepta cualquiera.
const remitente = () => `"Kodiak Gym" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@kodiak.local'}>`;

const urlFrontend = () => process.env.FRONTEND_URL || 'https://gimnacio-app.vercel.app';

const plantillaInvitacionAdmin = (nombre, gymNombre, url, dias) => `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12)">
  <div style="background:linear-gradient(160deg,#1e3a8a,#0f172a);padding:28px;text-align:center">
    <h1 style="color:#ffffff;font-size:22px;margin:0;letter-spacing:-0.5px">${gymNombre}</h1>
    <p style="color:#93c5fd;font-size:11px;margin:4px 0 0;letter-spacing:2px">PANEL DE ADMINISTRACIÓN</p>
  </div>
  <div style="background:#f8fbff;padding:32px">
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 12px">Ya puedes activar tu cuenta</h2>
    <p style="color:#475569;font-size:14px;margin:0 0 8px">Hola <strong>${nombre}</strong>,</p>
    <p style="color:#475569;font-size:14px;margin:0 0 24px">
      Te han asignado como administrador de <strong>${gymNombre}</strong>. Para entrar por primera vez,
      define tu contraseña con el siguiente botón. El enlace caduca en <strong>${dias} días</strong>.
    </p>
    <div style="text-align:center;margin:24px 0">
      <a href="${url}" style="background:#1d4ed8;color:#ffffff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
        Definir mi contraseña
      </a>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:20px 0 0">
      Si no esperabas este correo, ignóralo: sin definir la contraseña, la cuenta no se puede usar.
    </p>
  </div>
</div>`;

/**
 * Invita a un administrador a activar su cuenta.
 * @returns {Promise<boolean>} true si el correo salió; false si no hay
 *          configuración de correo o si el envío falló (queda en el log).
 */
async function enviarInvitacionAdmin({ email, nombre, gymNombre, token, dias }) {
  if (!emailConfigurado()) {
    console.error('Sin configuración de correo (SMTP_HOST o EMAIL_USER/EMAIL_PASS): no se envía la invitación de administrador');
    return false;
  }

  // `bienvenida=1` hace que la pantalla hable de "definir" y no de "restablecer".
  const url = `${urlFrontend()}/reset-password?token=${token}&bienvenida=1`;

  try {
    await transporter.sendMail({
      from: remitente(),
      to: email,
      subject: `Activa tu cuenta de administrador — ${gymNombre}`,
      html: plantillaInvitacionAdmin(nombre, gymNombre, url, dias),
    });
    return true;
  } catch (err) {
    console.error('No se pudo enviar la invitación de administrador:', err.message);
    return false;
  }
}

const plantillaBienvenidaSocio = (nombre, gymNombre, url) => `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12)">
  <div style="background:linear-gradient(160deg,#1e3a8a,#0f172a);padding:28px;text-align:center">
    <h1 style="color:#ffffff;font-size:22px;margin:0;letter-spacing:-0.5px">${gymNombre}</h1>
    <p style="color:#93c5fd;font-size:11px;margin:4px 0 0;letter-spacing:2px">¡BIENVENIDO!</p>
  </div>
  <div style="background:#f8fbff;padding:32px">
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 12px">Ya sos parte de ${gymNombre}</h2>
    <p style="color:#475569;font-size:14px;margin:0 0 8px">Hola <strong>${nombre}</strong>,</p>
    <p style="color:#475569;font-size:14px;margin:0 0 24px">
      Recepción ya registró tu inscripción. Para entrar a la app y ver tu rutina,
      tu membresía y más, definí tu contraseña con el siguiente botón.
    </p>
    <div style="text-align:center;margin:24px 0">
      <a href="${url}" style="background:#1d4ed8;color:#ffffff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
        Definir mi contraseña
      </a>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:20px 0 0">
      Si no esperabas este correo, ignoralo: sin definir la contraseña, la cuenta no se puede usar.
    </p>
  </div>
</div>`;

/**
 * Da la bienvenida a un socio recién matriculado y lo invita a definir su
 * propia contraseña, en vez de que recepción tenga que comunicarle una
 * temporal generada al azar.
 * @returns {Promise<boolean>} true si el correo salió; false si no hay
 *          configuración de correo o si el envío falló (queda en el log).
 */
async function enviarBienvenidaSocio({ email, nombre, gymNombre, token }) {
  if (!emailConfigurado()) {
    console.error('Sin configuración de correo (SMTP_HOST o EMAIL_USER/EMAIL_PASS): no se envía la bienvenida al socio');
    return false;
  }

  const url = `${urlFrontend()}/reset-password?token=${token}&bienvenida=1`;

  try {
    await transporter.sendMail({
      from: remitente(),
      to: email,
      subject: `¡Bienvenido a ${gymNombre}!`,
      html: plantillaBienvenidaSocio(nombre, gymNombre, url),
    });
    return true;
  } catch (err) {
    console.error('No se pudo enviar la bienvenida al socio:', err.message);
    return false;
  }
}

module.exports = { transporter, emailConfigurado, remitente, enviarInvitacionAdmin, enviarBienvenidaSocio };
