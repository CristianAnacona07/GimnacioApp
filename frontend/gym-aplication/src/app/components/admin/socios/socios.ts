import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../../services/auth';
import { UserStateService } from '../../../services/user-state.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';

@Component({
  selector: 'app-socios',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './socios.html',
  styleUrl: './socios.css',
})
export class Socios implements OnInit, OnDestroy {
  role = '';
  username = '';
  usuarios: any[] = [];
  loadingId: string | null = null;

  get socios() { return this.usuarios.filter(u => u.role !== 'admin'); }
  get admins() { return this.usuarios.filter(u => u.role === 'admin'); }
  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private userStateService: UserStateService,
    private toast: ToastService,
    private confirm: ConfirmService,
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
        error: () => this.toast.error('Error al cargar socios')
      });
  }

  esVencido(fecha: any): boolean {
    if (!fecha) return true;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return new Date(fecha) < hoy;
  }

  async renovar(id: string, dias: number, nombre = 'usuario') {
    const ok = await this.confirm.confirm(`¿Sumar ${dias} días a ${nombre}?`);
    if (!ok) return;

    this.loadingId = id;
    this.authService.renovarMembresia(id, dias)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success(`Membresía de ${nombre} renovada`);
          this.cargarUsuarios();
          this.loadingId = null;
        },
        error: () => {
          this.loadingId = null;
          this.toast.error('Error en la renovación');
        }
      });
  }

  async limpiarMembresia(id: string, nombre: string) {
    const ok = await this.confirm.confirm(
      `¿Estás seguro de eliminar la membresía de ${nombre}? Esto corregirá errores de asignación.`
    );
    if (!ok) return;

    this.loadingId = id;
    this.authService.limpiarMembresia(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Membresía limpiada correctamente');
          this.cargarUsuarios();
          this.loadingId = null;
        },
        error: () => {
          this.loadingId = null;
          this.toast.error('Error al limpiar la membresía');
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
