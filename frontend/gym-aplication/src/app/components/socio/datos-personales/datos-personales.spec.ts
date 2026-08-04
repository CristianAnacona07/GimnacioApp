import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { DatosPersonales } from './datos-personales';

describe('DatosPersonales', () => {
  let component: DatosPersonales;
  let fixture: ComponentFixture<DatosPersonales>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DatosPersonales],
      providers: [provideRouter([{ path: '**', children: [] }]), provideHttpClient(), provideHttpClientTesting()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DatosPersonales);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
