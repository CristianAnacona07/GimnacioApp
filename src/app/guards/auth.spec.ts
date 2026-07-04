import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { authGuard } from './auth';
import { StorageService } from '../services/storage.service';

/**
 * Meaningful tests for authGuard: token validity, gym presence and
 * role-based routing. StorageService and Router are mocked so the guard
 * logic is exercised in isolation.
 */
describe('authGuard', () => {
  let storage: {
    getToken: ReturnType<typeof vi.fn>;
    getGym: ReturnType<typeof vi.fn>;
    isTokenExpired: ReturnType<typeof vi.fn>;
    decodeTokenPayload: ReturnType<typeof vi.fn>;
    clearSessionPreservingData: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  function run(url: string): boolean {
    const state = { url } as RouterStateSnapshot;
    const route = {} as ActivatedRouteSnapshot;
    return TestBed.runInInjectionContext(() => authGuard(route, state) as boolean);
  }

  beforeEach(() => {
    storage = {
      getToken: vi.fn(),
      getGym: vi.fn(),
      isTokenExpired: vi.fn(),
      decodeTokenPayload: vi.fn(),
      clearSessionPreservingData: vi.fn(),
    };
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: StorageService, useValue: storage },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('redirige a /gimnasios cuando no hay gym seleccionado', () => {
    storage.getGym.mockReturnValue(null);
    storage.getToken.mockReturnValue('t');

    expect(run('/admin')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/gimnasios']);
  });

  it('redirige a /login cuando hay gym pero no token', () => {
    storage.getGym.mockReturnValue('mi-gym');
    storage.getToken.mockReturnValue(null);

    expect(run('/socio')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('limpia sesión y redirige a /login cuando el token está expirado', () => {
    storage.getGym.mockReturnValue('mi-gym');
    storage.getToken.mockReturnValue('t');
    storage.isTokenExpired.mockReturnValue(true);

    expect(run('/socio')).toBe(false);
    expect(storage.clearSessionPreservingData).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('limpia sesión y redirige cuando el payload no decodifica', () => {
    storage.getGym.mockReturnValue('mi-gym');
    storage.getToken.mockReturnValue('t');
    storage.isTokenExpired.mockReturnValue(false);
    storage.decodeTokenPayload.mockReturnValue(null);

    expect(run('/socio')).toBe(false);
    expect(storage.clearSessionPreservingData).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('permite a un admin acceder a la zona /admin', () => {
    storage.getGym.mockReturnValue('mi-gym');
    storage.getToken.mockReturnValue('t');
    storage.isTokenExpired.mockReturnValue(false);
    storage.decodeTokenPayload.mockReturnValue({ role: 'admin' });

    expect(run('/admin/socios')).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('permite a un superadmin acceder a la zona /admin', () => {
    storage.getGym.mockReturnValue('mi-gym');
    storage.getToken.mockReturnValue('t');
    storage.isTokenExpired.mockReturnValue(false);
    storage.decodeTokenPayload.mockReturnValue({ role: 'SuperAdmin' });

    expect(run('/admin')).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirige un socio que intenta entrar a /admin hacia /socio', () => {
    storage.getGym.mockReturnValue('mi-gym');
    storage.getToken.mockReturnValue('t');
    storage.isTokenExpired.mockReturnValue(false);
    storage.decodeTokenPayload.mockReturnValue({ role: 'socio' });

    expect(run('/admin')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/socio']);
  });

  it('redirige un entrenador que intenta entrar a /admin hacia /entrenador', () => {
    storage.getGym.mockReturnValue('mi-gym');
    storage.getToken.mockReturnValue('t');
    storage.isTokenExpired.mockReturnValue(false);
    storage.decodeTokenPayload.mockReturnValue({ role: 'entrenador' });

    expect(run('/admin')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/entrenador']);
  });

  it('redirige un admin que intenta entrar a /socio hacia /admin', () => {
    storage.getGym.mockReturnValue('mi-gym');
    storage.getToken.mockReturnValue('t');
    storage.isTokenExpired.mockReturnValue(false);
    storage.decodeTokenPayload.mockReturnValue({ role: 'admin' });

    expect(run('/socio/perfil')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('redirige un admin que intenta entrar a /entrenador hacia /admin', () => {
    storage.getGym.mockReturnValue('mi-gym');
    storage.getToken.mockReturnValue('t');
    storage.isTokenExpired.mockReturnValue(false);
    storage.decodeTokenPayload.mockReturnValue({ role: 'admin' });

    expect(run('/entrenador')).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/admin']);
  });

  it('permite a un entrenador acceder a la zona /entrenador', () => {
    storage.getGym.mockReturnValue('mi-gym');
    storage.getToken.mockReturnValue('t');
    storage.isTokenExpired.mockReturnValue(false);
    storage.decodeTokenPayload.mockReturnValue({ role: 'entrenador' });

    expect(run('/entrenador')).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('permite a un socio acceder a la zona /socio (rol con mayúsculas y espacios)', () => {
    storage.getGym.mockReturnValue('mi-gym');
    storage.getToken.mockReturnValue('t');
    storage.isTokenExpired.mockReturnValue(false);
    storage.decodeTokenPayload.mockReturnValue({ role: '  Socio  ' });

    expect(run('/socio/mi-rutina')).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
