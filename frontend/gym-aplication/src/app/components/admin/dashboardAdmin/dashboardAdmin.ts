import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { Navbar } from '../../shared/navbar/navbar';
import { AuthService } from '../../../services/auth';
import { UserStateService } from '../../../services/user-state.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, Navbar, RouterModule],
  templateUrl: './dashboardAdmin.html',
  styleUrl: './dashboardAdmin.css',
})
export class AdminDashboard implements OnInit, OnDestroy {
  role = '';
  username = '';
  usuarios: any[] = [];
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private userStateService: UserStateService,
    private toast: ToastService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    this.role = this.userStateService.getRole() || 'admin';
    this.username = localStorage.getItem('nombre') || 'Admin';
    this.cargarUsuarios();
  }

  cargarUsuarios() {
    this.authService.getUsuarios()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.usuarios = res;
          this.cdr.detectChanges();
        },
        error: () => this.toast.error('Error al cargar usuarios')
      });
  }

  esVencido(fecha: any): boolean {
    if (!fecha) return true;
    return new Date(fecha) < new Date();
  }

  renovar(id: string, dias: number) {
    this.authService.renovarMembresia(id, dias)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Membresía renovada');
          this.cargarUsuarios();
        },
        error: (err) => this.toast.error('Error al renovar: ' + (err.error?.mensaje || 'Intenta de nuevo'))
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
