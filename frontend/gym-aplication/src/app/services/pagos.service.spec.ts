import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { PagosService, Metodo } from './pagos.service';
import { environment } from '../../environments/environment';

describe('PagosService', () => {
  let service: PagosService;
  let httpMock: HttpTestingController;
  const BASE = `${environment.apiUrl}/api/pagos`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PagosService],
    });
    service = TestBed.inject(PagosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('obtenerMetodos hace GET a /api/pagos', () => {
    const fake: Metodo[] = [{ _id: '1', titulo: 'Nequi' }];
    let res: Metodo[] | undefined;
    service.obtenerMetodos().subscribe((r) => (res = r));

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush(fake);
    expect(res).toEqual(fake);
  });

  it('crearMetodo hace POST a /api/pagos con el body', () => {
    const body: Metodo = { titulo: 'Bancolombia', tipo: 'banco' };
    service.crearMetodo(body).subscribe();

    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ _id: 'x', ...body });
  });

  it('actualizarMetodo hace PUT a /api/pagos/:id', () => {
    const body: Metodo = { titulo: 'Editado' };
    service.actualizarMetodo('abc', body).subscribe();

    const req = httpMock.expectOne(`${BASE}/abc`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({ _id: 'abc', ...body });
  });

  it('eliminarMetodo hace DELETE a /api/pagos/:id', () => {
    service.eliminarMetodo('abc').subscribe();

    const req = httpMock.expectOne(`${BASE}/abc`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ _id: 'abc' });
  });
});
