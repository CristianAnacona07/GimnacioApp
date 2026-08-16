const crypto = require('crypto');
const {
  S3Client, PutObjectCommand, DeleteObjectCommand,
  HeadBucketCommand, CreateBucketCommand, PutBucketPolicyCommand
} = require('@aws-sdk/client-s3');

/**
 * Almacén de archivos (fotos de la página pública de cada gimnasio).
 *
 * Habla el protocolo de S3, así que el mismo código sirve para el MinIO del
 * docker-compose, para el MinIO del VPS y para cualquier almacén en la nube:
 * lo único que cambia son las variables S3_*.
 *
 *   S3_ENDPOINT    dónde escribe el backend  (http://minio:9000 dentro de Docker)
 *   S3_PUBLIC_URL  desde dónde lee el navegador (http://localhost:9010)
 *                  — son distintas porque el navegador no ve la red de Compose.
 *   S3_BUCKET      nombre del bucket (se crea solo la primera vez)
 *   S3_ACCESS_KEY / S3_SECRET_KEY   credenciales
 */

const ENDPOINT   = process.env.S3_ENDPOINT || '';
const PUBLIC_URL = (process.env.S3_PUBLIC_URL || ENDPOINT).replace(/\/$/, '');
const BUCKET     = process.env.S3_BUCKET || 'gimnacio';
const ACCESS_KEY = process.env.S3_ACCESS_KEY || '';
const SECRET_KEY = process.env.S3_SECRET_KEY || '';

// Tipos aceptados y su extensión. Fuera de esta lista no se guarda nada: el
// nombre del archivo lo pone el servidor, así que no se puede colar un .html
// o un .svg (que el navegador ejecutaría como script desde nuestro dominio).
const TIPOS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
};

const MAX_BYTES = 8 * 1024 * 1024;

/** Igual que emailConfigurado(): la única forma de saber si se puede guardar. */
const almacenConfigurado = () => !!(ENDPOINT && ACCESS_KEY && SECRET_KEY);

let cliente = null;
function obtenerCliente() {
  if (!cliente) {
    cliente = new S3Client({
      endpoint: ENDPOINT,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
      // MinIO sirve los buckets como ruta (endpoint/bucket/archivo) en vez de
      // como subdominio, que es lo que asume el SDK de AWS por defecto.
      forcePathStyle: true
    });
  }
  return cliente;
}

// El bucket se prepara una sola vez por proceso; la promesa se cachea para que
// varias subidas simultáneas no lo intenten crear a la vez.
let preparacion = null;
function prepararBucket() {
  if (preparacion) return preparacion;
  preparacion = (async () => {
    const s3 = obtenerCliente();
    try {
      await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
      return;
    } catch {
      // No existe (o no se puede consultar): se intenta crear.
    }
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    // Lectura pública: las fotos de la landing las pide cualquiera sin sesión.
    // La escritura sigue exigiendo credenciales, que solo tiene el backend.
    await s3.send(new PutBucketPolicyCommand({
      Bucket: BUCKET,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${BUCKET}/*`]
        }]
      })
    }));
  })().catch(err => {
    // Si falla, el siguiente intento vuelve a probar en vez de quedar roto.
    preparacion = null;
    throw err;
  });
  return preparacion;
}

/**
 * Guarda una imagen que llega como data URL (data:image/jpeg;base64,...) y
 * devuelve la URL pública. Lanza un error con mensaje legible si algo no cuadra.
 */
async function guardarImagen(dataUrl, carpeta = 'landing') {
  if (!almacenConfigurado()) throw new Error('El almacén de archivos no está configurado');
  if (typeof dataUrl !== 'string') throw new Error('Imagen inválida');

  const m = /^data:([a-z/+.-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) throw new Error('Imagen inválida');

  const extension = TIPOS[m[1].toLowerCase()];
  if (!extension) throw new Error('Formato no admitido: usa JPG, PNG o WebP');

  const bytes = Buffer.from(m[2], 'base64');
  if (!bytes.length) throw new Error('Imagen inválida');
  if (bytes.length > MAX_BYTES) throw new Error('La imagen supera los 8 MB');

  await prepararBucket();

  // Carpeta acotada a lo que escribe el propio backend (nunca el cliente).
  const prefijo = String(carpeta).replace(/[^a-z0-9/-]/gi, '') || 'landing';
  const clave = `${prefijo}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extension}`;

  await obtenerCliente().send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: clave,
    Body: bytes,
    ContentType: m[1].toLowerCase(),
    CacheControl: 'public, max-age=31536000, immutable'
  }));

  return `${PUBLIC_URL}/${BUCKET}/${clave}`;
}

/**
 * Borra un archivo a partir de su URL pública. Ignora las URLs que no sean de
 * este almacén (una foto puede venir de fuera) y nunca lanza: borrar es
 * limpieza, no debe tumbar la operación que la pidió.
 */
async function borrarPorUrl(url) {
  try {
    if (!almacenConfigurado() || typeof url !== 'string') return false;
    const base = `${PUBLIC_URL}/${BUCKET}/`;
    if (!url.startsWith(base)) return false;
    const clave = url.slice(base.length);
    if (!clave) return false;
    await obtenerCliente().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: clave }));
    return true;
  } catch {
    return false;
  }
}

module.exports = { almacenConfigurado, guardarImagen, borrarPorUrl };
