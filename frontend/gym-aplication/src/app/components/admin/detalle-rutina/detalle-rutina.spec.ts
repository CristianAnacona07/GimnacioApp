import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { DetalleRutina } from './detalle-rutina';

describe('DetalleRutina', () => {
  let component: DetalleRutina;
  let fixture: ComponentFixture<DetalleRutina>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetalleRutina],
      providers: [provideRouter([{ path: '**', children: [] }]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DetalleRutina);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
