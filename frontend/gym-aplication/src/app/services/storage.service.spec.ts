import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StorageService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('clearSessionPreservingData', () => {
    it('debe limpiar datos de autenticación pero preservar cronómetro', () => {
      // Arrange
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('usuario', JSON.stringify({ name: 'Test' }));
      localStorage.setItem('crono_endTime', '1234567890');
      localStorage.setItem('crono_total', '60');
      localStorage.setItem('gymActual', JSON.stringify({ id: '123' }));

      // Act
      service.clearSessionPreservingData();

      // Assert
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('usuario')).toBeNull();
      expect(localStorage.getItem('crono_endTime')).toBe('1234567890');
      expect(localStorage.getItem('crono_total')).toBe('60');
      expect(localStorage.getItem('gymActual')).toBeTruthy();
    });

    it('debe preservar tema dark/light', () => {
      // Arrange
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('theme', 'dark');

      // Act
      service.clearSessionPreservingData();

      // Assert
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('theme')).toBe('dark');
    });
  });

  describe('clearAuthSession', () => {
    it('debe limpiar solo datos de autenticación', () => {
      // Arrange
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('usuario', JSON.stringify({ name: 'Test' }));
      localStorage.setItem('role', 'admin');
      localStorage.setItem('crono_total', '60');

      // Act
      service.clearAuthSession();

      // Assert
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('usuario')).toBeNull();
      expect(localStorage.getItem('role')).toBeNull();
      expect(localStorage.getItem('crono_total')).toBe('60');
    });
  });

  describe('Token management', () => {
    it('debe guardar y obtener token', () => {
      // Arrange
      const token = 'test-token-123';

      // Act
      service.setToken(token);

      // Assert
      expect(service.getToken()).toBe(token);
    });

    it('debe detectar token expirado', () => {
      // Arrange - Token que expira en el pasado
      const expiredToken = createToken({ exp: Math.floor(Date.now() / 1000) - 3600 });
      service.setToken(expiredToken);

      // Act & Assert
      expect(service.isTokenExpired()).toBe(true);
    });

    it('debe detectar token válido', () => {
      // Arrange - Token que expira en el futuro
      const validToken = createToken({ exp: Math.floor(Date.now() / 1000) + 3600 });
      service.setToken(validToken);

      // Act & Assert
      expect(service.isTokenExpired()).toBe(false);
    });

    it('debe calcular tiempo restante del token', () => {
      // Arrange - Token que expira en 1 hora
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const token = createToken({ exp: futureExp });
      service.setToken(token);

      // Act
      const remaining = service.getTokenTimeRemaining();

      // Assert
      expect(remaining).toBeGreaterThan(3590000); // ~59 minutos en ms
      expect(remaining).toBeLessThan(3610000); // ~60 minutos en ms
    });

    it('debe detectar si el token expira pronto', () => {
      // Arrange - Token que expira en 20 minutos (< 30 minutos)
      const soonExp = Math.floor(Date.now() / 1000) + (20 * 60);
      const token = createToken({ exp: soonExp });
      service.setToken(token);

      // Act & Assert
      expect(service.isTokenExpiringSoon()).toBe(true);
    });

    it('debe detectar si el token NO expira pronto', () => {
      // Arrange - Token que expira en 30 días
      const farExp = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);
      const token = createToken({ exp: farExp });
      service.setToken(token);

      // Act & Assert
      expect(service.isTokenExpiringSoon()).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('debe manejar token inválido sin crashear', () => {
      // Arrange
      service.setToken('invalid-token');

      // Act & Assert
      expect(service.isTokenExpired()).toBe(true);
      expect(service.getTokenTimeRemaining()).toBe(0);
    });

    it('debe manejar ausencia de token', () => {
      // Act & Assert
      expect(service.getToken()).toBeNull();
      expect(service.isTokenExpired()).toBe(true);
      expect(service.getTokenTimeRemaining()).toBe(0);
    });
  });
});

/**
 * Helper para crear tokens JWT de prueba
 */
function createToken(payload: any): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  const signature = 'fake-signature';
  return `${header}.${body}.${signature}`;
}
