import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { BuscadorService, PersonaBuscada, PlanBuscado } from '../../../services/buscador.service';
import { UserStateService } from '../../../services/user-state.service';
import { GymService, Gym } from '../../../services/gym.service';

/** Una fila del panel de resultados. */
interface Item {
  tipo: 'seccion' | 'persona' | 'plan';
  /** Encabezado bajo el que se agrupa; también ordena la lista. */
  grupo: string;
  icono: string;
  titulo: string;
  detalle: string;
  ruta: string;
  queryParams?: Record<string, string>;
  /** Foto de la persona, si la tiene. */
  foto?: string;
  /** Etiqueta de estado de membresía ('vence en 5 d', 'VENCIDA'…). */
  estado?: string;
  estadoNivel?: 'ok' | 'aviso' | 'malo';
}

/** Sección navegable del menú, con el módulo del gym que la habilita. */
interface Seccion {
  icono: string;
  nombre: string;
  ruta: string;
  /** Palabras extra por las que también se encuentra ("cobro" → Matrícula). */
  alias?: string;
  modulo?: keyof Gym['modulos'];
}

/** Quita tildes y mayúsculas para que "matricula" encuentre "Matrícula". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Lupa del navbar: un buscador único para llegar a cualquier parte.
 *
 * Mezcla dos fuentes en la misma lista. Las **secciones** se filtran aquí
 * mismo, sin red, porque el menú ya se conoce y así el panel responde a la
 * primera tecla. Las **personas y planes** vienen del backend, que decide qué
 * puede ver cada rol: este componente nunca filtra por permisos, solo pinta.
 */
@Component({
  selector: 'app-buscador-global',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './buscador-global.html',
  styleUrl: './buscador-global.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BuscadorGlobal implements OnInit {
  private buscador = inject(BuscadorService);
  private userState = inject(UserStateService);
  private gymService = inject(GymService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  @ViewChild('campo') campo?: ElementRef<HTMLInputElement>;

  abierto = false;
  texto = '';
  buscando = false;
  /** Fila resaltada por el teclado; -1 = ninguna. */
  activo = -1;

  private role = '';
  private secciones: Seccion[] = [];
  private itemsSecciones: Item[] = [];
  private itemsRemotos: Item[] = [];
  private consulta$ = new Subject<string>();

  /** Lista final que pinta el panel, ya ordenada por grupo. */
  items: Item[] = [];

  ngOnInit(): void {
    this.role = this.userState.getRole() || 'socio';
    this.secciones = this.catalogoSecciones();

    this.consulta$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => {
          this.buscando = true;
          this.cdr.markForCheck();
          return this.buscador.buscar(q).pipe(catchError(() => of({ personas: [], planes: [] })));
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(res => {
        this.itemsRemotos = [
          ...(res.personas || []).map(p => this.aItemPersona(p)),
          ...(res.planes || []).map(p => this.aItemPlan(p))
        ];
        this.buscando = false;
        this.recomponer();
      });
  }

  // ── Apertura y cierre ──────────────────────────────────────────────────────

  abrir(): void {
    this.abierto = true;
    this.cdr.markForCheck();
    // El input aún no existe en el DOM cuando se pulsa el botón.
    setTimeout(() => this.campo?.nativeElement.focus(), 0);
  }

  cerrar(): void {
    this.abierto = false;
    this.texto = '';
    this.items = [];
    this.itemsRemotos = [];
    this.itemsSecciones = [];
    this.activo = -1;
    this.cdr.markForCheck();
  }

  /** Ctrl/⌘+K abre desde cualquier pantalla; Esc cierra. */
  @HostListener('document:keydown', ['$event'])
  atajos(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.abierto ? this.cerrar() : this.abrir();
      return;
    }
    if (event.key === 'Escape' && this.abierto) this.cerrar();
  }

  // ── Escritura ──────────────────────────────────────────────────────────────

  alEscribir(): void {
    const q = this.texto.trim();
    this.itemsSecciones = this.filtrarSecciones(q);

    if (q.length < 2) {
      // Con una sola letra no se molesta al servidor: las secciones bastan.
      this.itemsRemotos = [];
      this.buscando = false;
    } else {
      this.consulta$.next(q);
    }
    this.recomponer();
  }

  /** Teclado dentro del campo: mover la selección y entrar. */
  alTeclear(event: KeyboardEvent): void {
    if (!this.items.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activo = (this.activo + 1) % this.items.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activo = this.activo <= 0 ? this.items.length - 1 : this.activo - 1;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.ir(this.items[this.activo >= 0 ? this.activo : 0]);
    }
    this.cdr.markForCheck();
  }

  ir(item: Item): void {
    if (!item) return;
    this.router.navigate([item.ruta], item.queryParams ? { queryParams: item.queryParams } : {});
    this.cerrar();
  }

  /** True cuando esta fila estrena grupo, para pintar el encabezado. */
  esInicioDeGrupo(i: number): boolean {
    return i === 0 || this.items[i - 1].grupo !== this.items[i].grupo;
  }

  // ── Armado de la lista ─────────────────────────────────────────────────────

  private recomponer(): void {
    const orden = ['Secciones', 'Clientes', 'Trabajadores', 'Administradores', 'Planes'];
    this.items = [...this.itemsSecciones, ...this.itemsRemotos].sort(
      (a, b) => orden.indexOf(a.grupo) - orden.indexOf(b.grupo)
    );
    this.activo = this.items.length ? 0 : -1;
    this.cdr.markForCheck();
  }

  private filtrarSecciones(q: string): Item[] {
    if (!q) return [];
    const n = normalizar(q);
    return this.secciones
      .filter(s => normalizar(s.nombre + ' ' + (s.alias || '')).includes(n))
      .map(s => ({
        tipo: 'seccion' as const,
        grupo: 'Secciones',
        icono: s.icono,
        titulo: s.nombre,
        detalle: s.ruta,
        ruta: s.ruta
      }));
  }

  private aItemPersona(p: PersonaBuscada): Item {
    const esCliente = p.role === 'socio';
    const grupo = esCliente ? 'Clientes' : p.role === 'entrenador' ? 'Trabajadores' : 'Administradores';

    // Un entrenador entra a la ficha propia de su socio; el admin cae en la
    // lista de personas con el nombre precargado en el buscador de esa página.
    const ruta = this.role === 'entrenador' ? `/entrenador/socio/${p._id}` : '/admin/socios';
    const queryParams = this.role === 'entrenador' ? undefined : { q: p.nombre };

    const detalle = [p.identificacion && `CC ${p.identificacion}`, p.email]
      .filter(Boolean)
      .join(' · ');

    return {
      tipo: 'persona',
      grupo,
      icono: esCliente ? '👤' : p.role === 'entrenador' ? '🏋️' : '🛡️',
      titulo: p.nombre,
      detalle,
      ruta,
      queryParams,
      foto: p.fotoUrl || undefined,
      ...this.estadoMembresia(p)
    };
  }

  /** Traduce los días restantes a la etiqueta de color que ve el admin. */
  private estadoMembresia(p: PersonaBuscada): Pick<Item, 'estado' | 'estadoNivel'> {
    if (p.role !== 'socio') return {};
    if (p.diasRestantes === null) return { estado: 'sin membresía', estadoNivel: 'malo' };
    if (p.diasRestantes < 0) return { estado: 'VENCIDA', estadoNivel: 'malo' };
    if (p.diasRestantes === 0) return { estado: 'vence hoy', estadoNivel: 'aviso' };
    if (p.diasRestantes <= 7) return { estado: `vence en ${p.diasRestantes} d`, estadoNivel: 'aviso' };
    return { estado: `${p.diasRestantes} d`, estadoNivel: 'ok' };
  }

  private aItemPlan(p: PlanBuscado): Item {
    const partes = [
      p.precio != null ? `$${p.precio.toLocaleString('es-CO')}` : '',
      p.dias ? `${p.dias} días` : ''
    ].filter(Boolean);

    return {
      tipo: 'plan',
      grupo: 'Planes',
      icono: '💎',
      titulo: p.nombre,
      detalle: partes.join(' · '),
      ruta: this.role === 'socio' ? '/socio/planes' : '/admin/planes'
    };
  }

  /** Secciones alcanzables por el rol actual, sin las de módulos apagados. */
  private catalogoSecciones(): Seccion[] {
    const todas: Record<string, Seccion[]> = {
      admin: [
        { icono: '📰', nombre: 'Noticias', ruta: '/admin/noticias', modulo: 'noticias' },
        { icono: '🎫', nombre: 'Recepción', ruta: '/admin/recepcion', alias: 'checkin check-in entrada asistencia qr' },
        { icono: '💳', nombre: 'Matrícula / Pago', ruta: '/admin/matricula', alias: 'cobrar cobro renovar inscribir' },
        { icono: '👥', nombre: 'Socios', ruta: '/admin/socios', alias: 'clientes miembros personas trabajadores' },
        { icono: '💎', nombre: 'Planes', ruta: '/admin/planes', modulo: 'pagos', alias: 'membresias precios' },
        { icono: '💰', nombre: 'Pagos', ruta: '/admin/pagos', modulo: 'pagos', alias: 'transacciones ingresos caja' },
        { icono: '🏋️', nombre: 'Entrenadores', ruta: '/admin/entrenadores', alias: 'empleados trabajadores staff' },
        { icono: '📋', nombre: 'Rutinas', ruta: '/admin/rutinas', modulo: 'rutinas', alias: 'ejercicios entrenamiento' },
        { icono: '⚙️', nombre: 'Configuración', ruta: '/admin/configuracion', alias: 'ajustes opciones' },
        { icono: '🏢', nombre: 'Datos del gimnasio', ruta: '/admin/configuracion/gimnasio', alias: 'logo colores nombre modulos tema' },
        { icono: '🚪', nombre: 'Control de acceso', ruta: '/admin/configuracion/acceso', alias: 'huella torniquete lector dispositivos' },
        { icono: '📊', nombre: 'Datos y respaldo', ruta: '/admin/configuracion/datos', alias: 'exportar importar excel csv copia' },
        { icono: '🛡️', nombre: 'Auditoría', ruta: '/admin/configuracion/auditoria', alias: 'registro historial quien hizo' },
        { icono: '👤', nombre: 'Mi perfil', ruta: '/admin/configuracion/cuenta', alias: 'cuenta contrasena clave foto cedula telefono' }
      ],
      entrenador: [
        { icono: '👥', nombre: 'Mis socios', ruta: '/entrenador/socios', alias: 'clientes alumnos' }
      ],
      socio: [
        { icono: '📢', nombre: 'Noticias', ruta: '/socio/noticias', modulo: 'noticias' },
        { icono: '🏋️', nombre: 'Mi rutina', ruta: '/socio/mi-rutina', modulo: 'rutinas', alias: 'ejercicios entrenamiento' },
        { icono: '📈', nombre: 'Mi progreso', ruta: '/socio/progreso', modulo: 'progreso', alias: 'avance graficas' },
        { icono: '📏', nombre: 'Mis medidas', ruta: '/socio/medidas', modulo: 'medidas', alias: 'peso talla cintura' },
        { icono: '👤', nombre: 'Mi perfil', ruta: '/socio/perfil', alias: 'qr codigo acceso foto' },
        { icono: '📝', nombre: 'Mis datos personales', ruta: '/socio/datos-personales', alias: 'cedula telefono nacimiento' },
        { icono: '💎', nombre: 'Planes', ruta: '/socio/planes', modulo: 'pagos', alias: 'membresias precios renovar' },
        { icono: '💰', nombre: 'Mis pagos', ruta: '/socio/pagos', modulo: 'pagos', alias: 'recibos historial' },
        { icono: '💬', nombre: 'Ayúdanos a mejorar', ruta: '/socio/feedback', alias: 'sugerencia queja opinion' }
      ]
    };

    return (todas[this.role] || todas['socio']).filter(
      s => !s.modulo || this.gymService.moduloActivo(s.modulo)
    );
  }
}
