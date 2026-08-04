import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { EjercicioDetalle } from './ejercicio-detalle';

describe('EjercicioDetalle', () => {
  let component: EjercicioDetalle;
  let fixture: ComponentFixture<EjercicioDetalle>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EjercicioDetalle],
      providers: [provideRouter([{ path: '**', children: [] }]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EjercicioDetalle);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
