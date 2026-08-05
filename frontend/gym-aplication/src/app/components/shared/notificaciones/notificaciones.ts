import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { Aviso, NotificacionesService } from '../../../services/notificaciones.service';

/**
 * Campanita del navbar.
 *
 * No decide nada: el servicio le pasa los avisos ya calculados por el backend
 * y este componente solo los agrupa para pintarlos. Abrir el panel cuenta como
 * leerlos todos — es lo que espera cualquiera que ve un globito rojo y hace
 * click en él.
 */
@Component({
  selector: 'app-notificaciones',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notificaciones.html',
  styleUrl: './notificaciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Notificaciones implements OnInit {
  private servicio = inject(NotificacionesService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  abierto = false;
  noLeidos = 0;
  /** Avisos ya agrupados por su encabezado, en el orden en que llegaron. */
  grupos: { nombre: string; avisos: Aviso[] }[] = [];
  /** True mientras se sacude la campana al llegar algo nuevo. */
  agitando = false;

  ngOnInit(): void {
    this.servicio.iniciar();

    this.servicio.avisos$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(avisos => {
      this.grupos = this.agrupar(avisos);
      this.cdr.markForCheck();
    });

    this.servicio.noLeidos$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(n => {
      // Solo se sacude cuando el número sube; bajarlo (al leer) no debe animar.
      if (n > this.noLeidos) this.sacudir();
      this.noLeidos = n;
      this.cdr.markForCheck();
    });
  }

  alternar(): void {
    this.abierto = !this.abierto;
    if (this.abierto) this.servicio.marcarTodoLeido();
    this.cdr.markForCheck();
  }

  cerrar(): void {
    if (!this.abierto) return;
    this.abierto = false;
    this.cdr.markForCheck();
  }

  ir(aviso: Aviso): void {
    this.router.navigate([aviso.ruta]);
    this.cerrar();
  }

  /** Un click fuera del panel lo cierra. */
  @HostListener('document:click', ['$event'])
  alClicarFuera(event: MouseEvent): void {
    const destino = event.target as HTMLElement;
    if (!destino.closest('.campana-zona')) this.cerrar();
  }

  @HostListener('document:keydown.escape')
  alEscapar(): void {
    this.cerrar();
  }

  get vacio(): boolean {
    return this.grupos.length === 0;
  }

  private agrupar(avisos: Aviso[]): { nombre: string; avisos: Aviso[] }[] {
    const mapa = new Map<string, Aviso[]>();
    for (const a of avisos) {
      const lista = mapa.get(a.grupo);
      lista ? lista.push(a) : mapa.set(a.grupo, [a]);
    }
    return [...mapa.entries()].map(([nombre, lista]) => ({ nombre, avisos: lista }));
  }

  private sacudir(): void {
    this.agitando = true;
    setTimeout(() => {
      this.agitando = false;
      this.cdr.markForCheck();
    }, 900);
  }
}
