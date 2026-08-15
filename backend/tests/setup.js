// Setup global para las pruebas: fija un JWT_SECRET de prueba ANTES de que
// cualquier módulo de la app (que lee process.env.JWT_SECRET al importarse)
// sea cargado. Vitest ejecuta setupFiles antes de los ficheros de test.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-para-suite-de-pruebas';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://noop:noop@localhost:5432/test-noop';
