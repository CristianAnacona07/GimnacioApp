export const environment = {
  production: true,
  // TEMPORAL: apunta a la IP local de la PC para probar el APK debug contra
  // el backend real corriendo en Docker. Esta rama es solo para ese build.
  apiUrl: 'http://192.168.0.199:10000',
  tenantRootDomain: 'micro-gimnacios.com',
  // TEMPORAL: fija el slug de Kodiak Gym para que este APK de prueba abra
  // directo su landing pública en vez del login universal.
  gymSlugNativo: 'kodiak' as string | null
};
