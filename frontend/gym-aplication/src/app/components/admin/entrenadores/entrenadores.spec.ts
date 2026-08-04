import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Entrenadores } from './entrenadores';

describe('Entrenadores', () => {
  let component: Entrenadores;
  let fixture: ComponentFixture<Entrenadores>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Entrenadores]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Entrenadores);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
