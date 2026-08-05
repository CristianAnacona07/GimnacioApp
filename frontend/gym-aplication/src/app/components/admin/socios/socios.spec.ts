import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Socios } from './socios';

describe('Socios', () => {
  let component: Socios;
  let fixture: ComponentFixture<Socios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Socios],
      // El componente lee ?q= de la ruta para el filtro que precarga la lupa.
      providers: [provideRouter([{ path: '**', children: [] }]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Socios);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
