import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { ConfiguracionAcceso } from './acceso';

describe('ConfiguracionAcceso', () => {
  let component: ConfiguracionAcceso;
  let fixture: ComponentFixture<ConfiguracionAcceso>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfiguracionAcceso],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfiguracionAcceso);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('marca como "esperando" un equipo que aún no ha enviado ninguna marcación', () => {
    const estado = component.estado({ activo: true, ultimaConexion: null } as any);
    expect(estado.clase).toBe('estado--espera');
  });

  it('marca como desactivado por encima de cualquier otra cosa', () => {
    const estado = component.estado({ activo: false, ultimaConexion: '2026-08-05T10:00:00Z' } as any);
    expect(estado.clase).toBe('estado--off');
  });
});
