import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../../services/auth';
import { UserStateService } from '../../../services/user-state.service';
import { PermisosService } from '../../../services/permisos.service';
import { SedeService, Sede } from '../../../services/sede.service';
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
  /**
   * Cuenta contra `usuarios` sin filtrar por el buscador, no contra `socios`:
   * si el admin está buscando un nombre, el número de arriba no tiene que
   * bailar con cada tecla — sigue siendo el total real del gimnasio.
   *
   * "Activo" es lo mismo que ya usan las filas para pintar el pill verde
   * (fechaVencimiento presente y no vencida) y, no por casualidad, es
   * también el criterio exacto con el que el backend cuenta socios activos
   * para la facturación por suscriptor (ver sociosActivos en
   * planPlataformaVigencia.js) — así el número que ve el admin acá es el
   * mismo que le va a llegar al superadmin en la ficha de este gimnasio.
   */
  get sociosActivos(): number {
    return this.usuarios.filter(
      u => u.role === 'socio' && u.fechaVencimiento && !this.esVencido(u.fechaVencimiento)
    ).length;
  }
  /** Entrenadores: comparten tabla y acciones con los socios, pero no son clientes. */
  get trabajadores() { return this.filtrar(this.usuarios.filter(u => u.role === 'entrenador')); }
  get admins() { return this.filtrar(this.usuarios.filter(u => u.role === 'admin')); }

  private destroy$ = new Subject<void>();
  private permisos = inject(PermisosService);
  private sedeService = inject(SedeService);

  sedes: Sede[] = [];
  get hayVariasSedes(): boolean { return this.sedes.length > 1; }
  /** Mirando otro local: se consulta, no se toca. */
  get soloLectura(): boolean { return this.sedeService.soloLectura; }
  get nombreSedeActiva(): string { return this.sedeService.nombreActiva; }


  /**
   * Renovar días y limpiar la membresía tocan la plata del socio, así que
   * piden edición sobre la sección. Un entrenador con lectura ve la tabla
   * entera pero sin esos controles.
   */
  get puedeEditarMembresia(): boolean {
    return this.permisos.puede('socios', 'edicion');
  }

  /** Entrenadores del gimnasio, para el selector de cada fila. */
  entrenadores: any[] = [];

  /** Repartir socios entre entrenadores es del admin. */
  get puedeAsignarEntrenador(): boolean {
    return this.permisos.esAdmin;
  }

  /** Nombre a mostrar cuando la cuenta no puede cambiar la asignación. */
  nombreEntrenador(u: any): string {
    const e = this.entrenadores.find(e => e._id === u.entrenadorId);
    return e ? e.nombre : 'Sin asignar';
  }

  /** Columnas de la tabla: varían con lo que esta cuenta puede ver y tocar. */
  /** Mover a un socio de local. Optimista: si falla, se revierte y se avisa. */
  cambiarSede(u: any, sedeId: string): void {
    const anterior = u.sedeId || null;
    u.sedeId = sedeId || null;
    this.sedeService.asignar(u._id, sedeId || null).subscribe({
      next: () => this.toast.success(u.nombre + ' quedó en ' + (this.sedes.find(s => s._id === sedeId)?.nombre || 'sin sede')),
      error: () => {
        u.sedeId = anterior;
        this.toast.error('No se pudo cambiar la sede');
        this.cdr.detectChanges();
      }
    });
  }

  columnas(conEntrenador: boolean): number {
    return 4 + (conEntrenador ? 1 : 0) + (this.hayVariasSedes ? 1 : 0) + (this.puedeEditarMembresia ? 1 : 0);
  }

  cambiarEntrenador(socio: any, entrenadorId: string): void {
    const anterior = socio.entrenadorId || '';
    if (entrenadorId === anterior) return;

    // Se pinta al instante y se deshace si el servidor dice que no: esperar la
    // respuesta con el desplegable congelado se siente roto.
    socio.entrenadorId = entrenadorId || null;
    this.loadingId = socio._id;

    this.authService.asignarEntrenador(socio._id, entrenadorId || null).subscribe({
      next: () => {
        this.loadingId = null;
        const e = this.entrenadores.find(e => e._id === entrenadorId);
        this.toast.success(e ? `${socio.nombre} ahora entrena con ${e.nombre}` : `${socio.nombre} quedó sin entrenador`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        socio.entrenadorId = anterior || null;
        this.loadingId = null;
        this.toast.error(err.error?.mensaje || 'No se pudo asignar el entrenador');
        this.cdr.detectChanges();
      },
    });
  }

  /**
   * Esta pantalla la comparten el admin y el entrenador, y cada uno vive en su
   * propia zona de rutas: enlazar a /admin fijo mandaría al entrenador contra
   * el guard, que lo devolvería a su panel.
   */
  get zona(): string {
    return this.permisos.esAdmin ? '/admin' : '/entrenador';
  }

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

    // Al cambiar de sede en la barra, la tabla se rehace: el admin espera
    // ver los socios de ESE local, no los de todos.
    this.sedeService.sedes$
      .pipe(takeUntil(this.destroy$))
      .subscribe(s => { this.sedes = s; this.cdr.detectChanges(); });

    this.sedeService.sedeActiva$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => { this.cargarUsuarios(); this.cargarEntrenadores(); });
    // Sin llamada directa acá: la suscripción de arriba ya dispara la primera
    // carga, y hacerlo dos veces mostraba los socios de todas las sedes hasta
    // que llegaba la respuesta con la sede correcta.

  }

  /**
   * Para el selector de cada fila. Si falla se deja vacío y la tabla sigue
   * funcionando: repartir entrenadores no es lo principal de esta pantalla.
   */
  private cargarEntrenadores(): void {
    this.authService.getEmpleados()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (lista) => {
          this.entrenadores = (lista || []).filter((e: any) => e.role === 'entrenador');
          this.cdr.detectChanges();
        },
        error: () => {}
      });
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
