import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

import { Navbar } from '../../shared/navbar/navbar';
import { UserStateService } from '../../../services/user-state.service';

@Component({
  selector: 'app-empleado-dashboard',
  standalone: true,
  imports: [CommonModule, Navbar, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-100">
      <app-navbar></app-navbar>
      <div class="p-4 max-w-6xl mx-auto">
        <router-outlet></router-outlet>
      </div>
    </div>
  `,
})
export class EmpleadoDashboard implements OnInit {
  private userState = inject(UserStateService);

  ngOnInit() {
    // Nada que cargar: el navbar arma su menú según rol y cargo.
    this.userState.getCurrentUser();
  }
}
