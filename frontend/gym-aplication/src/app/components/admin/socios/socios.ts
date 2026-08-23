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

  /** Modal "Ver información" — perfil completo de un socio/entrenador. */
  mostrarDetalle = false;
  guardandoDetalle = false;
  detalleId: string | null = null;
  detalle: any = null;

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

  verInfo(id: string) {
    this.detalleId = id;
    this.detalle = null;
    this.mostrarDetalle = true;
    this.authService.getPerfilUsuario(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (perfil: any) => {
          this.detalle = {
            nombre: perfil.nombre || '',
            mensajeMotivador: perfil.mensajeMotivador || '',
            identificacion: perfil.datosPersonales?.identificacion || '',
            fechaNacimiento: perfil.datosPersonales?.fechaNacimiento || '',
            sexo: perfil.datosPersonales?.sexo || '',
            pesoActual: perfil.datosPersonales?.pesoActual || 0,
            altura: perfil.datosPersonales?.altura || 0,
            telefono: perfil.datosPersonales?.telefono || '',
            email: perfil.email || ''
          };
          this.cdr.detectChanges();
        },
        error: () => {
          this.toast.error('Error al cargar la información del socio');
          this.cerrarDetalle();
        }
      });
  }

  cerrarDetalle() {
    this.mostrarDetalle = false;
    this.detalleId = null;
    this.detalle = null;
  }

  guardarDetalle() {
    if (!this.detalleId || !this.detalle) return;
    this.guardandoDetalle = true;
    const { email, ...editable } = this.detalle;
    this.authService.actualizarPerfil(this.detalleId, {
      nombre: editable.nombre,
      mensajeMotivador: editable.mensajeMotivador,
      datosPersonales: {
        identificacion: editable.identificacion,
        fechaNacimiento: editable.fechaNacimiento,
        sexo: editable.sexo,
        pesoActual: Number(editable.pesoActual) || 0,
        altura: Number(editable.altura) || 0,
        telefono: editable.telefono
      }
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.guardandoDetalle = false;
        this.toast.success('Información actualizada');
        this.cerrarDetalle();
        this.cargarUsuarios();
      },
      error: () => {
        this.guardandoDetalle = false;
        this.toast.error('Error al guardar la información');
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
