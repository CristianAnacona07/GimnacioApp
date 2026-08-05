import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../../services/auth';
import { UserStateService } from '../../../services/user-state.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';

/** Quita tildes y mayúsculas para que "matias" encuentre a "Matías". */
function normalizar(texto: string): string {
  return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

@Component({
  selector: 'app-socios',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './socios.html',
  styleUrl: './socios.css',
})
export class Socios implements OnInit, OnDestroy {
  role = '';
  username = '';
  usuarios: any[] = [];
  loadingId: string | null = null;

  /** Texto del buscador de la página. La lupa del navbar lo precarga por `?q=`. */
  filtro = '';

  /** Socios propiamente dichos (clientes del gimnasio). */
  get socios() { return this.filtrar(this.usuarios.filter(u => u.role === 'socio')); }
  /** Entrenadores: comparten tabla y acciones con los socios, pero no son clientes. */
  get trabajadores() { return this.filtrar(this.usuarios.filter(u => u.role === 'entrenador')); }
  get admins() { return this.filtrar(this.usuarios.filter(u => u.role === 'admin')); }

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private userStateService: UserStateService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private ruta: ActivatedRoute
  ) {}

  ngOnInit() {
    this.role = this.userStateService.getRole() || 'admin';
    this.username = localStorage.getItem('nombre') || 'Admin';

    // La lupa del navbar navega aquí con ?q=<nombre>; así el admin aterriza
    // con la persona que buscó ya aislada en la tabla.
    this.ruta.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        this.filtro = params.get('q') || '';
        this.cdr.detectChanges();
      });

    this.cargarUsuarios();
  }

  /** Filtra por nombre, correo o cédula, ignorando tildes. */
  private filtrar(lista: any[]): any[] {
    const q = normalizar(this.filtro.trim());
    if (!q) return lista;
    return lista.filter(u =>
      normalizar(`${u.nombre} ${u.email} ${u.datosPersonales?.identificacion || ''}`).includes(q)
    );
  }

  limpiarFiltro(): void {
    this.filtro = '';
    // Se borra también de la URL para que recargar no lo resucite.
    this.router.navigate([], { relativeTo: this.ruta, queryParams: {} });
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
