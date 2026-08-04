import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { StorageService } from '../services/storage.service';

/**
 * Meaningful tests for authInterceptor: header injection, 401 session-clear
 * behaviour (protected vs public auth endpoints) and GET retry on 5xx.
 */
describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let storage: {
    getToken: ReturnType<typeof vi.fn>;
    clearSessionPreservingData: ReturnType<typeof vi.fn>;
  };
  let router: { navigate: ReturnType<typeof vi.fn> };

  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: StorageService, useValue: storage },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    storage = {
      getToken: vi.fn(),
      clearSessionPreservingData: vi.fn(),
    };
    router = { navigate: vi.fn() };
  });

  it('agrega el header Authorization cuando hay token', () => {
    storage.getToken.mockReturnValue('abc123');
    setup();

    http.get('/api/rutinas').subscribe();

    const req = httpMock.expectOne('/api/rutinas');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
    req.flush([]);
    httpMock.verify();
  });

  it('no agrega Authorization cuando no hay token', () => {
    storage.getToken.mockReturnValue(null);
    setup();

    http.get('/api/gym/buscar').subscribe();

    const req = httpMock.expectOne('/api/gym/buscar');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
    httpMock.verify();
  });

  it('nunca envía un header user-id controlable por el cliente', () => {
    storage.getToken.mockReturnValue('abc123');
    setup();

    http.get('/api/pagos').subscribe();

    const req = httpMock.expectOne('/api/pagos');
    expect(req.request.headers.has('user-id')).toBe(false);
    req.flush([]);
    httpMock.verify();
  });

  it('en un 401 sobre endpoint protegido (con token) limpia sesión y redirige', () => {
    storage.getToken.mockReturnValue('abc123');
    setup();

    let errored = false;
    http.get('/api/pagos').subscribe({ error: () => (errored = true) });

    httpMock
      .expectOne('/api/pagos')
      .flush('unauth', { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBe(true);
    expect(storage.clearSessionPreservingData).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    httpMock.verify();
  });

  it('en un 401 sobre /api/auth/login NO limpia sesión ni redirige', () => {
    storage.getToken.mockReturnValue(null);
    setup();

    let errored = false;
    http.post('/api/auth/login', {}).subscribe({ error: () => (errored = true) });

    httpMock
      .expectOne('/api/auth/login')
      .flush('bad creds', { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBe(true);
    expect(storage.clearSessionPreservingData).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    httpMock.verify();
  });

  it('en un 401 sin token (sin sesión real) NO limpia ni redirige', () => {
    storage.getToken.mockReturnValue(null);
    setup();

    http.get('/api/pagos').subscribe({ error: () => {} });

    httpMock
      .expectOne('/api/pagos')
      .flush('unauth', { status: 401, statusText: 'Unauthorized' });

    expect(storage.clearSessionPreservingData).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    httpMock.verify();
  });

  it('reintenta un GET ante un 5xx y sirve la respuesta del reintento', async () => {
    storage.getToken.mockReturnValue('abc123');
    setup();

    let result: any;
    http.get('/api/rutinas').subscribe((r) => (result = r));

    // Primer intento: 500 → el interceptor programa un reintento tras 800ms.
    httpMock
      .expectOne('/api/rutinas')
      .flush('boom', { status: 500, statusText: 'Server Error' });

    // Esperar el timer(800) del retry antes de que llegue la segunda petición.
    await new Promise((res) => setTimeout(res, 900));

    const retryReq = httpMock.expectOne('/api/rutinas');
    retryReq.flush([{ ok: true }]);

    expect(result).toEqual([{ ok: true }]);
    httpMock.verify();
  }, 5000);
});
