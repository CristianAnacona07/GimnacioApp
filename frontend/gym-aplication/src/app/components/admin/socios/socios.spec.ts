import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Socios } from './socios';

describe('Socios', () => {
  let component: Socios;
  let fixture: ComponentFixture<Socios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Socios]
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
