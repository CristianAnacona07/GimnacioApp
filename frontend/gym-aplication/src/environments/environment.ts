export const environment = {
  production: false,
  apiUrl: 'http://localhost:10000',
  // Dominio raíz para subdominios por gimnasio (multi-tenant).
  // En dev, 'localhost' permite probar con http://<slug>.localhost:4200
  // (ej: http://sogafi.localhost:4200 carga el gym con slug "sogafi").
  tenantRootDomain: 'localhost'
};
