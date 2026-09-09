import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Configuracion } from './configuracion';

describe('Configuracion', () => {
  let component: Configuracion;
  let fixture: ComponentFixture<Configuracion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Configuracion],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Configuracion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lista todas las secciones de configuración', () => {
    // La cuenta del propio admin no está en la lista: se entra por el botón
    // de la tarjeta con el nombre y el correo, arriba de todo. El número sale
    // de contar `secciones` — si agregás una sección, actualizalo acá también.
    expect(component.secciones.length).toBe(9);
    expect(component.secciones.every(s => s.ruta.startsWith('/admin/configuracion/'))).toBe(true);
  });
});
