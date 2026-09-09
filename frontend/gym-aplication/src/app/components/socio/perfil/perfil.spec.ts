import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Perfil } from './perfil';

describe('Perfil', () => {
  let component: Perfil;
  let fixture: ComponentFixture<Perfil>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Perfil],
      // La flecha de salida es un routerLink y vive FUERA del `@if (perfil)`,
      // así que se dibuja aunque el perfil todavía no haya llegado: sin router
      // en el test, el componente no se puede ni crear.
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Perfil);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('no muestra los días hasta saberlos de verdad', () => {
    // Un 0 provisional se lee como "se me venció la membresía": mientras no
    // llegue el dato real, no se pinta ningún número.
    expect(component.sabeLosDias).toBe(false);
  });
});
