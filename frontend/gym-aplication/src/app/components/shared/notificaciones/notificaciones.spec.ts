import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Notificaciones } from './notificaciones';

describe('Notificaciones', () => {
  let component: Notificaciones;
  let fixture: ComponentFixture<Notificaciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notificaciones],
      providers: [provideRouter([{ path: '**', children: [] }]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Notificaciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('arranca cerrado, sin avisos y sin globito', () => {
    expect(component.abierto).toBe(false);
    expect(component.noLeidos).toBe(0);
    expect(component.vacio).toBe(true);
  });

  it('abrir y cerrar el panel', () => {
    component.alternar();
    expect(component.abierto).toBe(true);

    component.cerrar();
    expect(component.abierto).toBe(false);
  });
});
