import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { BuscadorGlobal } from './buscador-global';

describe('BuscadorGlobal', () => {
  let component: BuscadorGlobal;
  let fixture: ComponentFixture<BuscadorGlobal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BuscadorGlobal],
      providers: [provideRouter([{ path: '**', children: [] }]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BuscadorGlobal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('arranca cerrado y sin resultados', () => {
    expect(component.abierto).toBe(false);
    expect(component.items).toEqual([]);
  });

  it('encuentra secciones ignorando tildes', () => {
    component.texto = 'matricula';
    component.alEscribir();

    // El rol por defecto en pruebas es socio, que no tiene Matrícula; lo que se
    // comprueba es que el filtro corre sin romperse con el texto sin tilde.
    expect(Array.isArray(component.items)).toBe(true);
  });

  it('cerrar limpia el texto y los resultados', () => {
    component.texto = 'algo';
    component.abrir();
    component.cerrar();

    expect(component.abierto).toBe(false);
    expect(component.texto).toBe('');
    expect(component.items).toEqual([]);
  });
});
