const nodemailer = require('nodemailer');

/**
 * Envío de correo de la plataforma.
 *
 * El transporter vive aquí para que auth.js y gym.js compartan una única
 * configuración. Si no hay forma de enviar no se envía nada: las funciones
 * devuelven false en vez de lanzar, porque un correo que no sale nunca debe
 * tumbar la operación de negocio que sí tuvo éxito.
 *
 * Dos modos, con las MISMAS credenciales (EMAIL_USER/EMAIL_PASS) en los dos:
 *  - SMTP genérico, si está definido SMTP_HOST. En desarrollo es Mailpit
 *    (`SMTP_HOST=mailpit`, `SMTP_PORT=1025`), que no pide auth y captura los
 *    correos en una bandeja web en vez de entregarlos a nadie — sin auth: si
 *    EMAIL_USER está vacío no se manda ninguna credencial. En producción es
 *    cualquier SMTP con autenticación real (Brevo, etc.), que si necesita
 *    EMAIL_USER/EMAIL_PASS.
 *  - Gmail, si no hay SMTP_HOST pero sí EMAIL_USER/EMAIL_PASS.
 */
const usaSmtpPropio = () => !!process.env.SMTP_HOST;

const construirTransporter = () => {
  if (usaSmtpPropio()) {
    const puerto = Number(process.env.SMTP_PORT) || 1025;
    // Tener credenciales es lo que distingue un SMTP real (Brevo, etc.) de un
    // capturador local (Mailpit), que no pide auth y habla en claro.
    const conAuth = !!process.env.EMAIL_USER;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: puerto,
      // 465 es TLS directo; 587 y 25 lo negocian por STARTTLS. SMTP_SECURE
      // permite forzarlo a mano, pero por defecto se deduce del puerto en vez
      // de exigir que alguien se acuerde de definir la variable.
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : puerto === 465,
      // Ignorar TLS solo tiene sentido contra un capturador sin auth. Un
      // proveedor real exige STARTTLS antes del AUTH: con ignoreTLS en true
      // rechaza la conexión y todo envío muere en "Error al enviar el correo"
      // — que es exactamente lo que pasaba en producción con Brevo, porque
      // SMTP_SECURE no existía y `!== 'true'` daba true.
      ignoreTLS: !conAuth,
      // Mismas variables que la rama de Gmail: un SMTP con auth real
      // (Brevo, etc.) usa EMAIL_USER/EMAIL_PASS igual que Gmail — no hay
      // ningún SMTP_USER/SMTP_PASS definido en .env.prod.example ni en los
      // docker-compose, así que leerlos de ahí dejaba la auth vacía en
      // cualquier SMTP de producción que la exigiera.
      auth: process.env.EMAIL_USER
        ? { user: process.env.EMAIL_USER, pass: (process.env.EMAIL_PASS || '').trim() }
        : undefined,
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: (process.env.EMAIL_USER || '').trim(),
      // Google muestra las contraseñas de aplicación en grupos de cuatro
      // ("abcd efgh ijkl mnop") y al pegarlas se cuelan los espacios, que
      // Gmail rechaza con 535 BadCredentials. Se limpian aquí para que un
      // copiar y pegar literal no deje al gimnasio sin correos.
      pass: (process.env.EMAIL_PASS || '').replace(/\s+/g, ''),
    },
  });
};

const transporter = construirTransporter();

const emailConfigurado = () => usaSmtpPropio() || !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);

// Nombre y lema de la plataforma en los correos. Estaban escritos a mano como
// "Kodiak Gym" en seis lugares distintos (encabezados, asuntos y remitente), y
// quedaron desactualizados cuando la plataforma pasó a llamarse Snake Gym: los
// socios recibían correos con una marca que ya no existe. Centralizados acá
// para que el próximo cambio de nombre sea una línea y no una cacería.
const MARCA = process.env.MARCA_NOMBRE || 'Snake Gym';
const MARCA_LEMA = process.env.MARCA_LEMA || 'CONSTRUYE TU MEJOR VERSIÓN';

// Remitente único para todos los correos. Con Mailpit no hay cuenta de Gmail,
// así que se usa una dirección de relleno: el buzón local acepta cualquiera.
const remitente = () => `"${MARCA}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@kodiak.local'}>`;

const urlFrontend = () => process.env.FRONTEND_URL || 'https://gimnacio-app.vercel.app';

const plantillaPasswordTemporal = (nombre, gymNombre, email, password, url) => `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12)">
  <div style="background:linear-gradient(160deg,#1e3a8a,#0f172a);padding:28px;text-align:center">
    <h1 style="color:#ffffff;font-size:22px;margin:0;letter-spacing:-0.5px">${gymNombre}</h1>
    <p style="color:#93c5fd;font-size:11px;margin:4px 0 0;letter-spacing:2px">¡BIENVENIDO!</p>
  </div>
  <div style="background:#f8fbff;padding:32px">
    <h2 style="color:#1e293b;font-size:18px;margin:0 0 12px">Ya tenés cuenta en ${gymNombre}</h2>
    <p style="color:#475569;font-size:14px;margin:0 0 8px">Hola <strong>${nombre}</strong>,</p>
    <p style="color:#475569;font-size:14px;margin:0 0 16px">
      Se creó tu cuenta en ${gymNombre}. Usá estas credenciales para entrar:
    </p>
    <div style="background:#eef3ff;border-radius:10px;padding:16px">
      <p style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px">
        Tus credenciales temporales
      </p>
      <p style="font-size:14px;color:#1e293b;margin:0 0 6px">
        <strong>Correo:</strong> ${email}
      </p>
      <p style="font-size:14px;color:#1e293b;margin:0">
        <strong>Contraseña temporal:</strong> ${password}
      </p>
    </div>
    <p style="color:#dc2626;font-size:13px;font-weight:600;margin:16px 0 0">
      Al entrar la primera vez vas a tener que cambiar esta contraseña por una propia.
    </p>
    <div style="text-align:center;margin:24px 0">
      <a href="${url}" style="background:#1d4ed8;color:#ffffff;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block">
        Ingresar por primera vez
      </a>
    </div>
    <p style="color:#94a3b8;font-size:12px;text-align:center;margin:20px 0 0">
      Si no esperabas este correo, ignoralo.
    </p>
  </div>
</div>`;

/**
 * Le manda a una cuenta recién creada (socio o admin) su contraseña temporal
 * ya generada por el sistema — no un enlace para elegir la suya — y la dirige
 * al login normal (con el correo precargado). El guard de rutas ya se encarga
 * de forzar el cambio de contraseña en el primer ingreso, así que no hace
 * falta una pantalla aparte para este primer login.
 * @returns {Promise<boolean>} true si el correo salió; false si no hay
 *          configuración de correo o si el envío falló (queda en el log).
 */
async function enviarPasswordTemporal({ email, nombre, gymNombre, password }) {
  if (!emailConfigurado()) {
    console.error('Sin configuración de correo (SMTP_HOST o EMAIL_USER/EMAIL_PASS): no se envía la contraseña temporal');
    return false;
  }

  const url = `${urlFrontend()}/login?email=${encodeURIComponent(email)}`;

  try {
    await transporter.sendMail({
      from: remitente(),
      to: email,
      subject: `Tu contraseña temporal en ${gymNombre}`,
      html: plantillaPasswordTemporal(nombre, gymNombre, email, password, url),
    });
    return true;
  } catch (err) {
    console.error('No se pudo enviar la contraseña temporal:', err.message);
    return false;
  }
}

module.exports = { transporter, emailConfigurado, remitente, enviarPasswordTemporal, MARCA, MARCA_LEMA };
