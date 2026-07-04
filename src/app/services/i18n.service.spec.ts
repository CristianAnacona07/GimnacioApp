import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { I18nService } from './i18n.service';

/**
 * Meaningful tests for I18nService.translate() dot-path resolution and
 * fallback. The constructor fires a GET for the stored/default dictionary,
 * which we flush to control the loaded dictionary.
 */
describe('I18nService', () => {
  let httpMock: HttpTestingController;

  function create(): I18nService {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), I18nService],
    });
    const service = TestBed.inject(I18nService);
    httpMock = TestBed.inject(HttpTestingController);
    return service;
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('carga el diccionario por defecto (es) al construirse', () => {
    const service = create();
    const req = httpMock.expectOne('assets/i18n/es.json');
    expect(req.request.method).toBe('GET');
    req.flush({ common: { guardar: 'Guardar' } });
    expect(service.lang()).toBe('es');
    httpMock.verify();
  });

  it('resuelve una clave dot-path anidada', () => {
    const service = create();
    httpMock.expectOne('assets/i18n/es.json').flush({
      nav: { perfil: 'Mi Perfil' },
      common: { guardar: 'Guardar' },
    });

    expect(service.translate('nav.perfil')).toBe('Mi Perfil');
    expect(service.translate('common.guardar')).toBe('Guardar');
    httpMock.verify();
  });

  it('devuelve la clave sin cambios cuando la ruta no existe (fallback)', () => {
    const service = create();
    httpMock.expectOne('assets/i18n/es.json').flush({ nav: { perfil: 'Mi Perfil' } });

    expect(service.translate('nav.inexistente')).toBe('nav.inexistente');
    expect(service.translate('no.existe.nada')).toBe('no.existe.nada');
    httpMock.verify();
  });

  it('devuelve la clave cuando el valor no es string (nodo intermedio)', () => {
    const service = create();
    httpMock.expectOne('assets/i18n/es.json').flush({ nav: { perfil: 'Mi Perfil' } });

    // 'nav' resuelve a un objeto, no a un string → fallback a la clave.
    expect(service.translate('nav')).toBe('nav');
    httpMock.verify();
  });

  it('devuelve clave vacía tal cual', () => {
    const service = create();
    httpMock.expectOne('assets/i18n/es.json').flush({});
    expect(service.translate('')).toBe('');
    httpMock.verify();
  });

  it('setLang cambia el idioma, persiste y recarga el diccionario', () => {
    const service = create();
    httpMock.expectOne('assets/i18n/es.json').flush({ hola: 'Hola' });

    service.setLang('en');
    httpMock.expectOne('assets/i18n/en.json').flush({ hola: 'Hello' });

    expect(service.lang()).toBe('en');
    expect(localStorage.getItem('lang')).toBe('en');
    expect(service.translate('hola')).toBe('Hello');
    httpMock.verify();
  });

  it('setLang ignora idiomas no soportados', () => {
    const service = create();
    httpMock.expectOne('assets/i18n/es.json').flush({});

    service.setLang('fr');

    expect(service.lang()).toBe('es');
    // No debe dispararse ninguna petición adicional.
    httpMock.verify();
  });
});
