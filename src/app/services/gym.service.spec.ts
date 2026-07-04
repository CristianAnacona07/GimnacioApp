import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { GymService, Gym } from './gym.service';
import { environment } from '../../environments/environment';

const BASE = `${environment.apiUrl}/api/gym`;

function fakeGym(over: Partial<Gym> = {}): Gym {
  return {
    _id: 'g1',
    nombre: 'Sogafi',
    slug: 'sogafi',
    logo: null,
    slogan: 'Entrena',
    colores: { primario: '', secundario: '', fondo: '', navbar: '', menu: '', dias: '' },
    modulos: { rutinas: true, progreso: true, medidas: true, pagos: true, noticias: true, cronometro: true },
    ...over,
  };
}

describe('GymService', () => {
  let service: GymService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), GymService],
    });
    service = TestBed.inject(GymService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('buscar hace GET a /api/gym/buscar con el query param q', () => {
    service.buscar('soga').subscribe();

    const req = httpMock.expectOne((r) => r.url === `${BASE}/buscar`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('q')).toBe('soga');
    req.flush([]);
  });

  it('getBySlug hace GET a /api/gym/:slug', () => {
    const g = fakeGym();
    let res: Gym | undefined;
    service.getBySlug('sogafi').subscribe((r) => (res = r));

    const req = httpMock.expectOne(`${BASE}/sogafi`);
    expect(req.request.method).toBe('GET');
    req.flush(g);
    expect(res).toEqual(g);
  });

  it('guardarGym persiste en localStorage y emite por gymCambio$', () => {
    const g = fakeGym({ _id: 'zzz' });
    let emitted: Gym | null = null;
    service.gymCambio$.subscribe((v) => (emitted = v));

    service.guardarGym(g);

    expect(JSON.parse(localStorage.getItem('gymActual')!)._id).toBe('zzz');
    expect(emitted!._id).toBe('zzz');
    expect(service.getGymId()).toBe('zzz');
  });

  it('limpiarGym elimina localStorage y emite null', () => {
    service.guardarGym(fakeGym());
    let emitted: Gym | null = fakeGym();
    service.gymCambio$.subscribe((v) => (emitted = v));

    service.limpiarGym();

    expect(localStorage.getItem('gymActual')).toBeNull();
    expect(emitted).toBeNull();
    expect(service.getGymId()).toBeNull();
  });

  it('moduloActivo devuelve true por defecto sin gym y respeta flags false', () => {
    // Sin gym cargado → permisivo (true).
    expect(service.moduloActivo('pagos')).toBe(true);

    service.guardarGym(fakeGym({ modulos: { rutinas: true, progreso: true, medidas: true, pagos: false, noticias: true, cronometro: true } }));
    expect(service.moduloActivo('pagos')).toBe(false);
    expect(service.moduloActivo('rutinas')).toBe(true);
  });
});
