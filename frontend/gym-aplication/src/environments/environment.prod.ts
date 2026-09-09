export const environment = {
  production: true,
  // El backend real es el VPS propio (docker-compose.prod.yml + Caddy), no
  // Vercel — ese destino está retirado. Esto es lo que hornea CUALQUIER build
  // nativo (Capacitor/APK), porque android-build.yml corre `npm run build` a
  // secas sin sed como el Dockerfile del frontend: si esta URL queda vieja,
  // el APK apunta a un backend caído aunque el sitio web funcione bien.
  apiUrl: 'https://snakegym.cloud',
  // De dónde bajan las imágenes y los GIF de ejercicios.
  //
  // Son 76 MB: dentro del APK lo dejarían en 80 MB y cada actualización por
  // aire bajaría lo mismo para cambiar un texto. Quedan en el servidor, que es
  // de donde ya los toma el navegador, y la app los pide igual que cualquier
  // otra cosa — necesita internet de todos modos.
  mediaUrl: 'https://snakegym.cloud',
  // Dominio raíz para subdominios por gimnasio: https://<slug>.snakegym.cloud
  tenantRootDomain: 'snakegym.cloud',
  // Slug fijo para builds nativos (Capacitor) de un solo gimnasio: al no
  // haber subdominio en la WebView, la ruta raíz abre su landing directo
  // en vez del login universal. null = comportamiento normal (multi-tenant).
  gymSlugNativo: null as string | null
};
