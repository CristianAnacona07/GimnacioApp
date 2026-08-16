export const environment = {
  production: false,
  // El backend en desarrollo es el contenedor del docker-compose, que publica
  // el 10000 en el host. Levantarlo con `docker compose -f docker-compose.local.yml
  // up -d` trae de paso Postgres, el correo de pruebas y el almacén de archivos.
  apiUrl: 'http://localhost:10000',
  // Dominio raíz para subdominios por gimnasio (multi-tenant).
  // En dev, 'localhost' permite probar con http://<slug>.localhost:4200
  // (ej: http://sogafi.localhost:4200 carga el gym con slug "sogafi").
  tenantRootDomain: 'localhost'
};
