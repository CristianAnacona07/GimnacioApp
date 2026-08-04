import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MiRutina } from './mi-rutina';

describe('MiRutina', () => {
  let component: MiRutina;
  let fixture: ComponentFixture<MiRutina>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MiRutina]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MiRutina);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
