export const environment = {
  production: true,
  apiUrl: 'https://gimnacio-app-backend.vercel.app',
  // Dominio raíz para subdominios por gimnasio: https://<slug>.gimnasios.co
  // ⚠️ Actualizar con el dominio real cuando se compre (ver docs/SUBDOMINIOS.md).
  // Mientras el dominio no exista, este valor no tiene ningún efecto:
  // en gimnacio-app.vercel.app la app funciona igual que siempre (selector de gyms).
  tenantRootDomain: 'micro-gimnacios.com',
  // Slug fijo para builds nativos (Capacitor) de un solo gimnasio: al no
  // haber subdominio en la WebView, la ruta raíz abre su landing directo
  // en vez del login universal. null = comportamiento normal (multi-tenant).
  gymSlugNativo: null as string | null
};
