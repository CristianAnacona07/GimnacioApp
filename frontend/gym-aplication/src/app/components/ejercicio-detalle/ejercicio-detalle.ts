import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { UserStateService } from '../../services/user-state.service';
import { ToastService } from '../../services/toast.service';
import { PiramideService, SeriePiramide } from '../../services/piramide.service';
import { CATALOGO_EJERCICIOS } from '../../../data/ejercicios-catalogo';

const SERIES_INICIALES = 4;
const MAX_SERIES = 12;

@Component({
  selector: 'app-ejercicio-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './ejercicio-detalle.html',
  styleUrl: './ejercicio-detalle.css',
})
export class EjercicioDetalle implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private userStateService = inject(UserStateService);
  private piramideService = inject(PiramideService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  ejercicio: any = null;
  role = '';

  // --- Piramidal ---
  // Es una anotación del socio, no un registro de lo que levantó: no entra en
  // Mi Progreso ni en su gráfico.
  abierto = false;
  cargando = false;
  guardando = false;
  series: SeriePiramide[] = [];
  nota = '';
  guardadaEn: string | null = null;

  // Con una pirámide guardada el desplegable se abre en modo lectura y hay que
  // tocar Editar para volver al formulario: lo normal es venir a consultarla,
  // no a cambiarla, y así no se modifica sin querer con el teléfono en la mano.
  editando = false;
  private respaldo: { series: SeriePiramide[]; nota: string } | null = null;

  get esSocio(): boolean {
    return this.role === 'socio';
  }

  get tieneGuardada(): boolean {
    return this.guardadaEn !== null;
  }

  /** Las series con algo escrito: son las que se muestran en modo lectura. */
  get seriesConDatos(): SeriePiramide[] {
    return this.series.filter(s => s.peso !== null || s.reps !== null);
  }

  get puedeAgregar(): boolean {
    return this.series.length < MAX_SERIES;
  }

  /** Hay algo escrito en alguna serie: sirve para no guardar una pirámide vacía. */
  get tieneDatos(): boolean {
    return this.series.some(s => s.peso !== null || s.reps !== null) || this.nota.trim().length > 0;
  }

  ngOnInit() {
    this.role = this.userStateService.getRole()?.toLowerCase().trim() || 'socio';

    const nombreEj = this.route.snapshot.paramMap.get('nombre');
    if (nombreEj) {
      this.ejercicio = CATALOGO_EJERCICIOS.find(
        e => e.nombre.toLowerCase() === nombreEj.toLowerCase()
      );
    }

    // La pirámide se pide al entrar y no al abrir el desplegable, porque el
    // botón cerrado tiene que avisar que hay una guardada.
    if (this.ejercicio && this.esSocio) this.cargarPiramide();
  }

  volver() {
    if (this.role === 'admin') {
      this.router.navigate(['/admin/rutinas']);
    } else {
      this.router.navigate(['/socio/mi-rutina']);
    }
  }

  alternarPiramidal() {
    this.abierto = !this.abierto;
  }

  private cargarPiramide() {
    this.cargando = true;
    this.piramideService.obtener(this.ejercicio.nombre).subscribe({
      next: (p) => {
        if (p && Array.isArray(p.series) && p.series.length) {
          this.series = p.series.map(s => ({ peso: s.peso ?? null, reps: s.reps ?? null }));
          this.nota = p.nota || '';
          this.guardadaEn = p.updatedAt || null;
          this.editando = false;          // hay pirámide: se abre para verla
        } else {
          this.series = this.filasVacias(SERIES_INICIALES);
          this.editando = true;           // no hay nada: directo al formulario
        }
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        // Sin conexión igual se puede escribir; el guardado avisará si falla.
        this.series = this.filasVacias(SERIES_INICIALES);
        this.editando = true;
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  /** Pasa al formulario, guardando una copia por si después cancela. */
  editar() {
    this.respaldo = {
      series: this.series.map(s => ({ ...s })),
      nota: this.nota
    };
    this.editando = true;
  }

  cancelarEdicion() {
    if (this.respaldo) {
      this.series = this.respaldo.series.map(s => ({ ...s }));
      this.nota = this.respaldo.nota;
    }
    this.respaldo = null;
    this.editando = false;
  }

  agregarSerie() {
    if (!this.puedeAgregar) return;
    this.series = [...this.series, { peso: null, reps: null }];
  }

  quitarSerie(i: number) {
    // Quitar del medio corre las de abajo, que es justo lo que se espera:
    // la posición en la lista es el número de serie.
    this.series = this.series.filter((_, idx) => idx !== i);
  }

  guardar() {
    if (this.guardando) return;
    if (!this.tieneDatos) {
      this.toast.error('Escribe al menos una serie o una recomendación');
      return;
    }

    this.guardando = true;
    const limpias = this.series.map(s => ({
      peso: this.aNumero(s.peso),
      reps: this.aNumero(s.reps)
    }));

    this.piramideService.guardar(this.ejercicio.nombre, limpias, this.nota.trim() || null).subscribe({
      next: (p) => {
        this.guardando = false;
        this.guardadaEn = p?.updatedAt || new Date().toISOString();
        // Guardar cierra el formulario y deja la pirámide a la vista.
        this.series = limpias;
        this.respaldo = null;
        this.editando = false;
        this.toast.success('Piramidal guardado');
        this.cdr.detectChanges();
      },
      error: () => {
        this.guardando = false;
        this.toast.error('No se pudo guardar. Revisa tu conexión.');
        this.cdr.detectChanges();
      }
    });
  }

  borrar() {
    if (this.guardando) return;
    if (!confirm('¿Borrar el piramidal de este ejercicio?')) return;

    this.guardando = true;
    this.piramideService.eliminar(this.ejercicio.nombre).subscribe({
      next: () => {
        this.series = this.filasVacias(SERIES_INICIALES);
        this.nota = '';
        this.guardadaEn = null;
        this.respaldo = null;
        this.editando = true;   // sin nada guardado, vuelve al formulario vacío
        this.guardando = false;
        this.toast.success('Piramidal borrado');
        this.cdr.detectChanges();
      },
      error: () => {
        this.guardando = false;
        this.toast.error('No se pudo borrar');
        this.cdr.detectChanges();
      }
    });
  }

  private filasVacias(n: number): SeriePiramide[] {
    return Array.from({ length: n }, () => ({ peso: null, reps: null }));
  }

  /** El input devuelve '' cuando se vacía; eso tiene que viajar como null. */
  private aNumero(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
}
