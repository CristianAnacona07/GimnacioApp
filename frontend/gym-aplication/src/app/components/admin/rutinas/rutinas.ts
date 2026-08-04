import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DragDropModule } from '@angular/cdk/drag-drop';

import { AuthService } from '../../../services/auth';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';
import { CATALOGO_EJERCICIOS, CATEGORIAS_UNICAS } from '../../../../data/ejercicios-catalogo';

@Component({
  selector: 'app-rutinas',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, RouterModule],
  templateUrl: './rutinas.html',
  styleUrls: ['./rutinas.css']
})
export class Rutinas implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  categorias = CATEGORIAS_UNICAS;
  categoriaActiva = 'Pecho';
  ejerciciosDeCategoria: any[] = [];
  ejerciciosVisibles: any[] = [];
  limiteActual = 20;

  usuarioId = '';
  nombreRutina = '';
  dia = '';
  enfoque = '';

  rutinaParaSocio: any[] = [];
  listaSocios: any[] = [];

  editandoModo = false;
  idRutinaParaEditar = '';
  rutinasExistentesDelSocio: any[] = [];

  ngOnInit() {
    const catGuardada = this.route.snapshot.queryParamMap.get('cat') || 'Pecho';
    this.filtrarPorCategoria(catGuardada);

    const idSocio = this.route.snapshot.paramMap.get('id');
    const idRutina = this.route.snapshot.queryParamMap.get('rutinaId');

    if (idSocio) {
      this.usuarioId = idSocio;
      this.cargarRutinasDelSocio(idSocio, idRutina);
    }

    this.authService.getUsuarios()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any[]) => {
          // Filtrar para mostrar solo socios, excluyendo admins y superadmins
          this.listaSocios = res.filter(u => u.role === 'socio');
          this.cdr.detectChanges();
        },
        error: () => this.toast.error('Error al cargar socios')
      });
  }

  onSocioChange() {
    if (this.usuarioId) this.cargarRutinasDelSocio(this.usuarioId);
  }

  cargarRutinasDelSocio(idSocio: string, idRutinaABuscar: string | null = null) {
    if (!idSocio?.trim()) {
      this.rutinasExistentesDelSocio = [];
      return;
    }

    this.authService.obtenerRutina(idSocio)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.rutinasExistentesDelSocio = Array.isArray(res) ? res : [res];

          if (idRutinaABuscar) {
            const encontrada = this.rutinasExistentesDelSocio.find(r => r._id === idRutinaABuscar);
            if (encontrada) {
              this.editandoModo = true;
              this.idRutinaParaEditar = encontrada._id;
              this.nombreRutina = encontrada.nombre;
              this.dia = encontrada.dia;
              this.enfoque = encontrada.enfoque;
              this.rutinaParaSocio = [...encontrada.ejercicios];
            }
          }

          this.cdr.detectChanges();
        },
        error: (err) => {
          if (err.status === 404) {
            this.rutinasExistentesDelSocio = [];
          } else {
            console.error('Error al obtener rutinas del socio', err);
          }
        }
      });
  }

  filtrarPorCategoria(cat: string) {
    this.categoriaActiva = cat;
    this.limiteActual = 20;
    this.ejerciciosDeCategoria = CATALOGO_EJERCICIOS.filter(e => e.categoria === cat);
    this.actualizarVista();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { cat },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  actualizarVista() {
    this.ejerciciosVisibles = this.ejerciciosDeCategoria.slice(0, this.limiteActual);
  }

  cargarMas() {
    this.limiteActual += 20;
    this.actualizarVista();
  }

  agregarA_Rutina(ej: any) {
    // Copiar solo los campos que persiste el modelo Rutina (no todo el catálogo:
    // gif, categoría, descripción, tips inflan innecesariamente el documento).
    this.rutinaParaSocio.push({
      nombre: ej.nombre,
      imagenUrl: ej.imagenUrl || ej.gifUrl || '',
      instrucciones: ej.instrucciones ?? ej.tip ?? ej.descripcion ?? '',
      series: 4,
      repeticiones: '10',
      completado: false
    });
  }

  quitarDeRutina(index: number) {
    this.rutinaParaSocio.splice(index, 1);
  }

  async guardarRutina() {
    if (!this.nombreRutina) this.nombreRutina = `${this.enfoque} - ${this.dia}`;

    if (!this.usuarioId)               return this.toast.error('Por favor, selecciona un socio');
    if (!this.dia)                     return this.toast.error('Selecciona un día de la semana');
    if (!this.enfoque)                 return this.toast.error('Indica el enfoque (ej: Pecho y Tríceps)');
    if (!this.rutinaParaSocio.length)  return this.toast.error('La rutina no tiene ejercicios');

    const data = {
      usuarioId: this.usuarioId,
      nombre: this.nombreRutina,
      dia: this.dia,
      enfoque: this.enfoque,
      ejercicios: this.rutinaParaSocio
    };

    const rutinaExistenteEnEseDia = this.rutinasExistentesDelSocio.find(
      r => r.dia.toLowerCase() === this.dia.toLowerCase()
    );

    if (this.editandoModo || rutinaExistenteEnEseDia) {
      const idParaActualizar = this.editandoModo
        ? this.idRutinaParaEditar
        : rutinaExistenteEnEseDia?._id || '';

      const msg = this.editandoModo
        ? `¿Deseas guardar los cambios en la rutina "${this.nombreRutina}"?`
        : `El día ${this.dia} ya tiene una rutina (${rutinaExistenteEnEseDia?.enfoque}). ¿Deseas sobrescribirla?`;

      const ok = await this.confirm.confirm(msg);
      if (!ok) return;

      this.authService.actualizarRutina(idParaActualizar, data)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toast.success('¡Rutina actualizada correctamente!');
            this.finalizarProceso(this.editandoModo);
          },
          error: (err) => this.toast.error('Error al actualizar: ' + (err.error?.mensaje || err.message))
        });
    } else {
      this.authService.asignarRutina(data)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.toast.success('¡Nueva rutina creada con éxito!');
            this.finalizarProceso(false);
          },
          error: (err) => this.toast.error(err.error?.mensaje || 'Error al guardar')
        });
    }
  }

  finalizarProceso(volverALista: boolean) {
    const idTemporal = this.usuarioId;
    this.rutinaParaSocio = [];
    this.dia = '';
    this.enfoque = '';
    this.editandoModo = false;
    this.idRutinaParaEditar = '';
    this.cdr.detectChanges();

    if (volverALista) {
      this.router.navigate(['/admin/rutinas', idTemporal]);
    } else {
      this.cargarRutinasDelSocio(idTemporal);
    }
  }

  limpiarFormulario() {
    this.rutinaParaSocio = [];
    this.nombreRutina = '';
    this.editandoModo = false;
    this.idRutinaParaEditar = '';
    this.cdr.detectChanges();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
