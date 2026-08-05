const nodemailer = require('nodemailer');

/**
 * Envío de correo de la plataforma.
 *
 * El transporter vive aquí para que auth.js y gym.js compartan una única
 * configuración. Si EMAIL_USER/EMAIL_PASS no están definidos no se envía nada:
 * las funciones devuelven false en vez de lanzar, porque un correo que no sale
 * nunca debe tumbar la operación de negocio que sí tuvo éxito.
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const emailConfigurado = () => !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

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
    console.error('EMAIL_USER/EMAIL_PASS no configurados: no se envía la invitación de administrador');
    return false;
  }

  // `bienvenida=1` hace que la pantalla hable de "definir" y no de "restablecer".
  const url = `${urlFrontend()}/reset-password?token=${token}&bienvenida=1`;

  try {
    await transporter.sendMail({
      from: `"Kodiak Gym" <${process.env.EMAIL_USER}>`,
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

module.exports = { transporter, emailConfigurado, enviarInvitacionAdmin };
