/**
 * Texto de Términos y Condiciones / Política de Privacidad mostrado en el
 * registro. El nombre del gimnasio se inserta según el gym de la invitación
 * (register.ts); "Snake Gym" es el respaldo cuando no hay uno cargado.
 */
export const NOMBRE_APP_RESPALDO = 'Snake Gym';

/**
 * Versión vigente de estos documentos. Gemela de VERSION_LEGAL en
 * backend/lib/legal.js — si el texto de acá cambia de forma sustancial, hay
 * que subir AMBAS: es lo que queda guardado en `User.terminosVersion` para
 * saber qué texto aceptó cada persona.
 */
export const VERSION_LEGAL = '1.0';

export function textoTerminos(gymNombre: string): string {
  const gym = gymNombre || NOMBRE_APP_RESPALDO;
  return `1. Objeto
Estos Términos y Condiciones regulan el acceso y uso de la aplicación a través de la cual ${gym} gestiona membresías, rutinas, asistencia, pagos y demás servicios ofrecidos a sus socios. Al registrarte y usar la aplicación, aceptas estos términos en su totalidad.

2. Registro y cuenta
Las cuentas solo se crean a través de ${gym}, ya sea por un enlace de invitación o con credenciales entregadas por el personal del gimnasio; no existe el registro abierto al público. Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta. La información que proporciones debe ser veraz y actualizada. ${gym} puede suspender o eliminar cuentas en caso de uso indebido, fraude o incumplimiento de estos términos.

3. Uso del servicio
La aplicación se ofrece para: control de asistencia (check-in), asignación y consulta de rutinas, registro de pagos y vencimientos de membresía, seguimiento de progreso físico, noticias del gimnasio, y agendamiento de sesiones personalizadas cuando el gimnasio lo ofrezca. Te comprometes a no usar la aplicación para fines distintos a los previstos, ni a intentar vulnerar su seguridad. El acceso físico al gimnasio mediante código QR o huella dactilar (si está habilitado) es personal e intransferible.

4. Pagos y membresías
Las tarifas, planes y vigencias son definidas por ${gym} y pueden cambiar sin que ello afecte pagos ya realizados. El registro de un pago extiende la fecha de vencimiento de tu membresía según el plan contratado. Cualquier reclamo sobre pagos se gestiona directamente con ${gym}. El incumplimiento en el pago puede resultar en suspensión del acceso hasta regularizar la situación.

5. Salud y responsabilidad
El ejercicio físico conlleva riesgos inherentes. Al usar la aplicación y participar en las actividades de ${gym}, declaras estar en condiciones físicas adecuadas o haber consultado a un profesional de la salud antes de iniciar cualquier rutina. Las rutinas sugeridas son de carácter general y no sustituyen la valoración de un entrenador certificado o un médico. ${gym} no se hace responsable por lesiones derivadas del mal uso de equipos, del incumplimiento de indicaciones del personal, o de condiciones médicas preexistentes no informadas.

6. Uso de imagen
Si ${gym} publica fotos o videos de sus actividades en los que puedas aparecer, se solicitará tu consentimiento previo o se ofrecerá la opción de exclusión.

7. Modificaciones y terminación
Estos términos pueden actualizarse; los cambios relevantes se notificarán dentro de la aplicación. Puedes solicitar la cancelación de tu cuenta en cualquier momento, y ${gym} puede terminar tu acceso por incumplimiento de estos términos o impago prolongado.

8. Contacto
Para dudas sobre estos términos, contacta directamente a ${gym} por sus canales habituales.`;
}

export function textoPrivacidad(gymNombre: string): string {
  const gym = gymNombre || NOMBRE_APP_RESPALDO;
  return `1. Responsable del tratamiento
${gym} es responsable del tratamiento de tus datos personales como socio. La aplicación actúa como herramienta tecnológica que ${gym} usa para gestionar esta información.

2. Qué datos recolectamos
Datos de identificación y contacto (nombre, correo, teléfono, identificación, fecha de nacimiento, sexo); datos físicos (peso, altura, medidas, fotos de progreso si las cargas); datos de membresía y pagos (plan, vigencia, historial de transacciones); datos de uso (asistencia, rutinas asignadas, citas, racha de asistencias); y datos biométricos (huella dactilar), únicamente si ${gym} tiene habilitado el control de acceso por huella.

3. Para qué usamos tus datos
Gestionar tu membresía y el acceso al gimnasio, asignarte rutinas y mostrarte tu progreso, agendar sesiones, enviarte notificaciones de vencimiento y avisos del gimnasio, y mantener la seguridad de la aplicación. No usamos tus datos con fines publicitarios ni los vendemos a terceros.

4. Datos biométricos (huella dactilar)
El registro de huella es opcional y solo aplica si ${gym} ofrece control de acceso biométrico. Se usa exclusivamente para verificar tu identidad al ingresar. Puedes solicitar su eliminación en cualquier momento sin que eso afecte tu membresía.

5. Con quién compartimos tus datos
Con proveedores de infraestructura que almacenan la información en nuestro nombre, y con proveedores de comunicación (correo electrónico y, si está activado, WhatsApp) para enviarte confirmaciones y recibos. No compartimos tus datos con otros gimnasios de la plataforma. Podemos compartir datos si una autoridad competente lo requiere por ley.

6. Cuánto tiempo conservamos tus datos
Mientras tu cuenta esté activa en ${gym}, y por el tiempo adicional que exija la normativa aplicable para el historial de pagos. Si solicitas la eliminación de tu cuenta, tus datos dejan de usarse operativamente.

7. Tus derechos
Puedes solicitar en cualquier momento a ${gym}: acceder a tus datos, corregirlos, solicitar su eliminación, y retirar tu consentimiento para el uso de datos biométricos sin que eso afecte el resto del servicio.

8. Seguridad
Las contraseñas se almacenan cifradas, nunca en texto plano. El acceso a los datos está restringido según tu rol dentro de la aplicación. Las comunicaciones viajan cifradas.

9. Menores de edad
Si ${gym} permite socios menores de edad, el registro y tratamiento de sus datos requiere el consentimiento de su padre, madre o representante legal.

10. Cambios a esta política
Podemos actualizar esta Política de Privacidad; los cambios relevantes se notificarán dentro de la aplicación.

11. Contacto
Para ejercer tus derechos sobre tus datos, contacta directamente a ${gym} por sus canales habituales.`;
}
