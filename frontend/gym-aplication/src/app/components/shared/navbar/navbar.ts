import { ChangeDetectorRef, Component, EventEmitter, HostListener, OnInit, OnDestroy, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AuthService } from '../../../services/auth';
import { UserStateService } from '../../../services/user-state.service';
import { GymService } from '../../../services/gym.service';
import { ThemeService } from '../../../services/theme.service';
import { BuscadorGlobal } from '../buscador-global/buscador-global';
import { Notificaciones } from '../notificaciones/notificaciones';
import { NotificacionesService } from '../../../services/notificaciones.service';
import { PermisosService } from '../../../services/permisos.service';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterModule, BuscadorGlobal, Notificaciones],
  standalone: true,
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit, OnDestroy {
  role = '';
  username = '';
  fotoUrl = 'https://ui-avatars.com/api/?name=Usuario&background=random';

  /**
   * El menú se dibuja superpuesto sobre la página (absolute + z-50). En el
   * panel del socio eso no molesta porque su contenido es angosto y queda a
   * la derecha, pero en los paneles anchos (admin, entrenador) el menú tapaba
   * las tarjetas de la izquierda. Cada armazón escucha este evento para
   * correr su contenido mientras el menú está abierto.
   */
  @Output() menuAbiertoCambio = new EventEmitter<boolean>();

  private _menuOpen = false;
  get menuOpen(): boolean { return this._menuOpen; }
  set menuOpen(valor: boolean) {
    if (this._menuOpen === valor) return;
    this._menuOpen = valor;
    this.menuAbiertoCambio.emit(valor);
  }

  private notificaciones = inject(NotificacionesService);
  private theme = inject(ThemeService);
  private permisos = inject(PermisosService);

  get esOscuro(): boolean { return this.theme.modo === 'oscuro'; }

  alternarTema(): void {
    this.theme.alternarModo();
    this.cdr.detectChanges();
  }

  private static perfilCache: any = null;
  private static lastLoadTime = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000;
  private destroy$ = new Subject<void>();

  // Cache local del gym: se inicializa y actualiza vía gymCambio$ (BehaviorSubject)
  // para no parsear localStorage en cada ciclo de detección de cambios.
  private gym: any = null;

  get gymNombre(): string { return this.gym?.nombre || 'GymApp'; }
  get gymLogo(): string | null { return this.gym?.logo || null; }
  get navbarBg(): string { return this.gym?.colores?.navbar || '#0f172a'; }
  get menuBg(): string { return (this.gym?.colores as any)?.menu || '#1e293b'; }

  constructor(
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private userStateService: UserStateService,
    private gymService: GymService
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.menu-container') && !target.closest('.menu-button') && this.menuOpen) {
      this.menuOpen = false;
    }
  }

  /** A dónde lleva el avatar: cada rol tiene su propia pantalla de cuenta. */
  get rutaPerfil(): string {
    if (this.role === 'socio') return '/socio/perfil';
    if (this.role === 'admin') return '/admin/configuracion';
    if (this.role === 'entrenador') return '/entrenador/mis-socios';
    return '/empleado/inicio';
  }

  get menuLinks() {
    const m = (mod: Parameters<typeof this.gymService.moduloActivo>[0]) =>
      this.gymService.moduloActivo(mod);

    if (this.role === 'admin') {
      return [
        { icon: '📰', name: 'noticias',     route: '/admin/noticias',     show: m('noticias') },
        { icon: '🎫', name: 'Recepción',    route: '/admin/recepcion',    show: true },
        { icon: '💳', name: 'Matrícula / Pago', route: '/admin/matricula', show: true },
        { icon: '👥', name: 'socios',        route: '/admin/socios',        show: true },
        { icon: '💳', name: 'planes',        route: '/admin/planes',        show: m('pagos') },
        { icon: '💰', name: 'pagos',         route: '/admin/pagos',         show: m('pagos') },
        { icon: '🧑‍💼', name: 'empleados',   route: '/admin/empleados',     show: true },
        { icon: '📋', name: 'rutinas',       route: '/admin/rutinas',       show: m('rutinas') },
        { icon: '⚙️', name: 'Configuración', route: '/admin/configuracion', show: true },
        { icon: '🚪', name: 'Cerrar Sesión', route: 'logout', isAction: true, show: true }
      ].filter(l => l.show);
    } else if (this.role === 'entrenador') {
      const p = this.permisos;
      return [
        { icon: '📰', name: 'noticias',      route: '/entrenador/noticias',   show: p.puede('noticias') && m('noticias') },
        { icon: '🎯', name: 'mis socios',    route: '/entrenador/mis-socios', show: true },
        { icon: '👥', name: 'socios',        route: '/entrenador/socios',     show: p.puede('socios') },
        { icon: '📋', name: 'rutinas',       route: '/entrenador/rutinas',    show: p.puede('rutinas') && m('rutinas') },
        { icon: '🎫', name: 'Recepción',     route: '/entrenador/recepcion',  show: p.puede('recepcion') },
        { icon: '💳', name: 'planes',        route: '/entrenador/planes',     show: p.puede('planes') && m('pagos') },
        { icon: '💰', name: 'pagos',         route: '/entrenador/pagos',      show: p.puede('pagos') && m('pagos') },
        { icon: '🧑‍💼', name: 'empleados',   route: '/entrenador/empleados',  show: p.puede('empleados') },
        { icon: '📅', name: 'mi agenda',     route: '/entrenador/agenda',     show: true },
        { icon: '🚪', name: 'Cerrar Sesión', route: 'logout', isAction: true, show: true }
      ].filter(l => l.show);
    } else if (this.role === 'empleado') {
      // El recepcionista trabaja en Recepción; los demás cargos solo tienen su inicio.
      const cargo = this.userStateService.getCurrentUser()?.cargo || '';
      return [
        { icon: '🎫', name: 'Recepción',     route: '/empleado/recepcion', show: cargo === 'recepcionista' },
        { icon: '🏠', name: 'Inicio',        route: '/empleado/inicio',    show: cargo !== 'recepcionista' },
        { icon: '🚪', name: 'Cerrar Sesión', route: 'logout', isAction: true, show: true }
      ].filter(l => l.show);
    } else if (this.role === 'socio') {
      return [
        { icon: '📢',    name: 'noticias',    route: '/socio/noticias',   show: m('noticias') },
        { icon: '🏋️‍♂️', name: 'mi rutina',  route: '/socio/mi-rutina',  show: m('rutinas') },
        { icon: '📈',    name: 'mi progreso', route: '/socio/progreso',   show: m('progreso') },
        { icon: '📅',    name: 'agendar',     route: '/socio/agendar',    show: true },
        { icon: '👤',    name: 'perfil',      route: '/socio/perfil',     show: true },
        { icon: '💎',    name: 'planes',      route: '/socio/planes',     show: m('pagos') },
        { icon: '💰',    name: 'pagos',              route: '/socio/pagos',      show: m('pagos') },
        { icon: '💬',    name: 'Ayúdanos a mejorar', route: '/socio/feedback',   show: true },
        { icon: '🏃‍♂️', name: 'Cerrar Sesión',       route: 'logout', isAction: true, show: true }
      ].filter(l => l.show);
    }
    return [];
  }

  ngOnInit() {
    this.role = this.userStateService.getRole() || 'socio';
    this.username = localStorage.getItem('nombre') || 'Usuario';

    // Re-renderiza cuando cambian los datos del gym (módulos, colores, logo)
    this.gymService.gymCambio$
      .pipe(takeUntil(this.destroy$))
      .subscribe(gym => { this.gym = gym; this.cdr.detectChanges(); });

    this.userStateService.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe(userData => {
        if (!userData) return;
        this.username = userData.nombre || this.username;
        if (userData.fotoUrl?.trim()) {
          this.fotoUrl = userData.fotoUrl;
        }
      });

    const userId = this.userStateService.getUserId();
    if (userId) {
      this.cargarDatosUsuario(userId);
    } else {
      this.fotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.username)}&background=random`;
    }
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  cargarDatosUsuario(userId: string) {
    const now = Date.now();
    const cacheValido = Navbar.perfilCache &&
      (now - Navbar.lastLoadTime) < this.CACHE_DURATION &&
      Navbar.perfilCache.userId === userId;

    if (cacheValido) {
      this.aplicarDatosPerfil(Navbar.perfilCache.data);
      return;
    }

    this.authService.obtenerPerfil(userId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (perfil: any) => {
          Navbar.perfilCache = { userId, data: perfil };
          Navbar.lastLoadTime = Date.now();
          this.aplicarDatosPerfil(perfil);
        },
        error: () => {
          this.fotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.username)}&background=random`;
        }
      });
  }

  private aplicarDatosPerfil(perfil: any) {
    this.username = perfil.nombre || 'Usuario';
    this.fotoUrl = perfil.fotoUrl?.trim()
      ? perfil.fotoUrl
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(perfil.nombre)}&background=random`;
    this.cdr.detectChanges();
  }

  manejarErrorFoto(event: any) {
    event.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(this.username)}&background=random`;
  }

  handleMenuClick(link: any) {
    if (link.isAction && link.route === 'logout') {
      this.logout();
    } else {
      this.router.navigate([link.route]);
    }
    this.menuOpen = false;
  }

  logout() {
    Navbar.perfilCache = null;
    Navbar.lastLoadTime = 0;
    // El servicio de avisos es singleton y seguiría sondeando tras el logout,
    // con el token ya borrado: hay que pararlo a mano.
    this.notificaciones.detener();
    this.authService.logout();
    this.router.navigateByUrl(this.gymService.rutaSalida());
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
