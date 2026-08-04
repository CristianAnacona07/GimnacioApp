import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject, forkJoin, of } from 'rxjs';
import { takeUntil, map, catchError } from 'rxjs/operators';

import { AuthService } from '../../../services/auth';
import { ToastService } from '../../../services/toast.service';
import { ProgresoService } from '../../../services/progreso.service';
import { UserStateService } from '../../../services/user-state.service';
import { DIAS_RUTINA } from '../../../../data/ejercicios-catalogo';

interface SetForm { peso: number | null; reps: number | null; }

// Claves para persistir el formulario de progreso
const KEY_FORM_IDX = 'progreso_formIdx';
const KEY_FORM_DATA = 'progreso_formData';
const KEY_FORM_EJERCICIO = 'progreso_ejercicio';

@Component({
  selector: 'app-mi-rutina',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './mi-rutina.html',
  styleUrl: './mi-rutina.css',
})
export class MiRutina implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private progresoService = inject(ProgresoService);
  private userState = inject(UserStateService);
  private toast = inject(ToastService);
  private destroy$ = new Subject<void>();

  rutinas: any[] = [];
  rutinaActual: any = null;
  username = '';
  diasRutina: string[] = Object.values(DIAS_RUTINA);
  diaActivo: string = this.diasRutina[0];

  formularioIdx: number | null = null;
  setsForm: SetForm[] = [];
  guardando = false;
  cargando = true;

  scrollToActiveDay() {
    setTimeout(() => {
      const activeBtn = document.getElementById('btn-' + this.diaActivo);
      if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, 200);
  }

  private resetarSiEsDiaDistinto(usuarioId: string) {
    const hoy = new Date().toISOString().split('T')[0];
    // Marca por-usuario (no global): en un dispositivo compartido, el reset de
    // un socio no debe bloquear el de otro. Se guarda {usuarioId, fecha}.
    let prev: any = null;
    try { prev = JSON.parse(localStorage.getItem('ultimoResetRutina') || 'null'); } catch { prev = null; }
    if (prev && prev.usuarioId === usuarioId && prev.fecha === hoy) return;
    this.authService.resetDiario(usuarioId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => localStorage.setItem('ultimoResetRutina', JSON.stringify({ usuarioId, fecha: hoy })),
        error: () => this.toast.error('Error al resetear la rutina diaria')
      });
  }

  ngOnInit() {
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    this.diaActivo = diasSemana[new Date().getDay()];

    const usuario = this.userState.getCurrentUser();
    if (!usuario) return;
    this.username = usuario.nombre || 'Socio';

    this.resetarSiEsDiaDistinto(usuario._id);

    this.authService.obtenerRutina(usuario._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.rutinas = Array.isArray(res) ? res : [res];
          this.cargando = false;
          this.buscarRutinaDelDia(this.diaActivo);

          // Restaurar formulario de progreso si existe
          this.restaurarFormularioProgreso();

          this.cdr.detectChanges();
          this.scrollToActiveDay();
        },
        error: () => {
          this.cargando = false;
          this.cdr.detectChanges();
        }
      });
  }

  buscarRutinaDelDia(dia: string) {
    if (this.rutinas?.length > 0) {
      this.rutinaActual = this.rutinas.find(r => r.dia.toLowerCase() === dia.toLowerCase()) ?? null;
    }
  }

  cambiarDia(dia: string) {
    this.diaActivo = dia;
    this.buscarRutinaDelDia(dia);
    this.formularioIdx = null;
    this.cdr.detectChanges();
  }

  toggleEjercicio(ejer: any, index: number) {
    const rutinaDelDia = this.rutinaActual;
    if (!rutinaDelDia?._id) return;

    // Actualiza UI inmediatamente sin esperar al servidor
    const valorAnterior = ejer.completado;
    ejer.completado = !valorAnterior;
    this.cdr.detectChanges();

    this.authService.toggleEjercicioCompletado(rutinaDelDia._id, index, ejer.completado)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        error: () => {
          ejer.completado = valorAnterior; // revertir si falla
          this.cdr.detectChanges();
          this.toast.error('No se pudo guardar el progreso.');
        }
      });
  }

  abrirFormulario(ejer: any, index: number, event: MouseEvent) {
    event.stopPropagation();
    if (this.formularioIdx === index) {
      this.formularioIdx = null;
      this.limpiarFormularioStorage();
      return;
    }
    this.formularioIdx = index;
    const numSeries = Number(ejer.series) || 4;

    // Intentar restaurar datos previos para este ejercicio
    const datosGuardados = this.obtenerDatosGuardados(ejer.nombre, index);
    if (datosGuardados) {
      this.setsForm = datosGuardados;
    } else {
      this.setsForm = Array.from({ length: numSeries }, () => ({ peso: null, reps: null }));
    }

    // Guardar estado inicial
    this.guardarFormularioEnStorage(ejer.nombre, index);

    this.cdr.detectChanges();

    setTimeout(() => {
      document.getElementById('progreso-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  cerrarFormulario(event: MouseEvent) {
    event.stopPropagation();
    this.formularioIdx = null;
    this.limpiarFormularioStorage();
  }

  guardarProgreso(ejer: any, event: MouseEvent) {
    event.stopPropagation();
    const usuario = this.userState.getCurrentUser();
    if (!usuario?._id) return;

    const setsConDatos = this.setsForm.filter(s => s.peso !== null || s.reps !== null);
    if (!setsConDatos.length) {
      this.toast.error('Ingresa al menos un dato en una serie');
      return;
    }

    this.guardando = true;

    // Enviar todas las series en paralelo; cada una reporta éxito/fallo sin
    // abortar a las demás (no se trata un fallo parcial como éxito total).
    const peticiones = setsConDatos.map(set =>
      this.progresoService.guardarRegistro({
        usuarioId: usuario._id,
        ejercicioNombre: ejer.nombre,
        pesoKg: set.peso ?? undefined,
        repeticiones: set.reps ?? undefined
      }).pipe(
        map(() => true),
        catchError(() => of(false))
      )
    );

    forkJoin(peticiones).pipe(takeUntil(this.destroy$)).subscribe(resultados => {
      const guardados = resultados.filter(Boolean).length;
      const fallidos = resultados.length - guardados;

      this.guardando = false;
      this.formularioIdx = null;

      if (fallidos === 0) {
        this.limpiarFormularioStorage(); // Limpiar solo si todo se guardó bien
        this.toast.success(`✓ ${guardados} serie${guardados !== 1 ? 's' : ''} guardada${guardados !== 1 ? 's' : ''}`);
      } else if (guardados === 0) {
        this.toast.error('No se pudo guardar el progreso. Revisa tu conexión.');
      } else {
        this.toast.error(`Se guardaron ${guardados} de ${resultados.length} series. Reintenta las demás.`);
      }
      this.cdr.detectChanges();
    });
  }

  /**
   * Guarda el formulario de progreso en localStorage para que no se pierda
   */
  private guardarFormularioEnStorage(ejercicioNombre: string, index: number): void {
    try {
      localStorage.setItem(KEY_FORM_IDX, String(index));
      localStorage.setItem(KEY_FORM_EJERCICIO, ejercicioNombre);
      localStorage.setItem(KEY_FORM_DATA, JSON.stringify(this.setsForm));
    } catch (error) {
      console.warn('No se pudo guardar formulario en localStorage:', error);
    }
  }

  /**
   * Actualiza el formulario en localStorage cuando el usuario cambia valores
   */
  actualizarFormularioStorage(): void {
    if (this.formularioIdx !== null) {
      try {
        localStorage.setItem(KEY_FORM_DATA, JSON.stringify(this.setsForm));
      } catch (error) {
        console.warn('No se pudo actualizar formulario:', error);
      }
    }
  }

  /**
   * Obtiene datos guardados para un ejercicio específico
   */
  private obtenerDatosGuardados(ejercicioNombre: string, index: number): SetForm[] | null {
    try {
      const idxGuardado = localStorage.getItem(KEY_FORM_IDX);
      const ejercicioGuardado = localStorage.getItem(KEY_FORM_EJERCICIO);
      const datosGuardados = localStorage.getItem(KEY_FORM_DATA);

      if (idxGuardado === String(index) &&
          ejercicioGuardado === ejercicioNombre &&
          datosGuardados) {
        return JSON.parse(datosGuardados);
      }
    } catch (error) {
      console.warn('Error al restaurar datos:', error);
    }
    return null;
  }

  /**
   * Restaura el formulario si se recargó la página mientras estaba abierto
   */
  private restaurarFormularioProgreso(): void {
    try {
      const idxGuardado = localStorage.getItem(KEY_FORM_IDX);
      const ejercicioGuardado = localStorage.getItem(KEY_FORM_EJERCICIO);
      const datosGuardados = localStorage.getItem(KEY_FORM_DATA);

      if (idxGuardado && ejercicioGuardado && datosGuardados && this.rutinaActual?.ejercicios) {
        const index = Number(idxGuardado);
        const ejercicio = this.rutinaActual.ejercicios[index];

        // Verificar que sea el mismo ejercicio
        if (ejercicio?.nombre === ejercicioGuardado) {
          this.formularioIdx = index;
          this.setsForm = JSON.parse(datosGuardados);
          this.cdr.detectChanges();

          // Scroll al formulario después de un momento
          setTimeout(() => {
            document.getElementById('progreso-panel')?.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest'
            });
          }, 300);
        }
      }
    } catch (error) {
      console.warn('Error al restaurar formulario:', error);
      this.limpiarFormularioStorage();
    }
  }

  /**
   * Limpia los datos del formulario de localStorage
   */
  private limpiarFormularioStorage(): void {
    localStorage.removeItem(KEY_FORM_IDX);
    localStorage.removeItem(KEY_FORM_EJERCICIO);
    localStorage.removeItem(KEY_FORM_DATA);
  }

  ngOnDestroy() {
    // NO limpiar el formulario al destruir, para que se preserve entre navegaciones
    this.destroy$.next();
    this.destroy$.complete();
  }
}
