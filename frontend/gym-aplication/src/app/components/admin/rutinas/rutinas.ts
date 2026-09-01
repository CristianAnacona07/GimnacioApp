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
import { UserStateService } from '../../../services/user-state.service';
import { RutinaPlantillaService, RutinaPlantilla, RutinaPlantillaDia, RutinaPlantillaEjercicio } from '../../../services/rutina-plantilla.service';
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
  private userState = inject(UserStateService);
  private plantillaService = inject(RutinaPlantillaService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();

  // Las rutinas plantilla son exclusivas del administrador — ver comentario
  // del modelo RutinaPlantilla (schema.prisma). El entrenador usa esta misma
  // pantalla pero nunca ve ni el catálogo de plantillas ni el botón para
  // guardar una nueva.
  esAdmin = this.userState.getRole() === 'admin';
  plantillas: RutinaPlantilla[] = [];
  guardandoPlantilla = false;
  aplicandoPlantillaId: string | null = null;

  /**
   * Mientras `borradorPlantilla` no es null, la pantalla está en "modo
   * plantilla": el panel derecho deja de ser la rutina de un socio y pasa a
   * ser la semana de la plantilla que se está armando. `diaActivo` decide a
   * qué día se agregan los ejercicios del catálogo.
   *
   * `idPlantillaEditando` es null cuando la plantilla es nueva, y trae el id
   * cuando se abrió una existente para editarla.
   */
  readonly DIAS_SEMANA = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];
  borradorPlantilla: { nombre: string; dias: RutinaPlantillaDia[] } | null = null;
  idPlantillaEditando: string | null = null;
  diaActivo = 'Lunes';

  categorias = CATEGORIAS_UNICAS;
  categoriaActiva = 'Pecho';
  ejerciciosDeCategoria: any[] = [];
  ejerciciosVisibles: any[] = [];
  limiteActual = 20;

  usuarioId = '';
  nombreRutina = '';
  dia = '';
  /** Ultimo dia confirmado: permite revertir el selector si cancela el aviso. */
  diaAnterior = '';
  enfoque = '';

  /**
   * Autocompleta el "Enfoque" palabra por palabra contra los músculos del
   * catálogo (los mismos botones de arriba: Pecho, Hombro, Tríceps…). Al
   * escribir "P" completa a "Pecho" con el resto seleccionado — si sigue
   * escribiendo, sobreescribe la sugerencia; si no, queda tal cual. Con un
   * espacio se pasa a la siguiente palabra, así se arman frases como
   * "Pecho Tríceps" letra por letra.
   */
  onEnfoqueInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const valor = input.value;
    this.enfoque = valor;

    // Solo autocompleta si está escribiendo al final del texto — editar en
    // medio de la frase no debería disparar sugerencias raras.
    const cursorAlFinal = input.selectionStart === valor.length && input.selectionEnd === valor.length;
    if (!cursorAlFinal) return;

    const separador = valor.lastIndexOf(' ');
    const antes = separador >= 0 ? valor.slice(0, separador + 1) : '';
    const palabra = separador >= 0 ? valor.slice(separador + 1) : valor;
    if (!palabra) return;

    const coincidencia = this.categorias.find(
      (c: string) => c.length > palabra.length && c.toLowerCase().startsWith(palabra.toLowerCase())
    );
    if (!coincidencia) return;

    const nuevoValor = antes + coincidencia;
    this.enfoque = nuevoValor;
    // Se aplica en el siguiente ciclo: Angular todavía no escribió el nuevo
    // valor en el <input> cuando se llega hasta acá.
    setTimeout(() => {
      input.setSelectionRange(antes.length + palabra.length, nuevoValor.length);
    });
  }

  rutinaParaSocio: any[] = [];
  /**
   * Puesto de la lista que espera un reemplazo, o null. Mientras tiene valor,
   * el siguiente ejercicio del catalogo entra ahi en vez de al final.
   */
  reemplazandoIndice: number | null = null;
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

    if (this.esAdmin) this.cargarPlantillas();
  }

  cargarPlantillas() {
    this.plantillaService.listar()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { this.plantillas = res; this.cdr.detectChanges(); },
        error: () => this.toast.error('Error al cargar las plantillas')
      });
  }

  // ── Modo plantilla ────────────────────────────────────────────────────────
  // Mientras hay borrador, el panel derecho es la SEMANA de la plantilla (un
  // día a la vez, elegido con las pestañas) y no la rutina de un socio.

  nuevaPlantilla() {
    this.borradorPlantilla = { nombre: '', dias: [] };
    this.idPlantillaEditando = null;
    this.diaActivo = 'Lunes';
    this.cdr.detectChanges();
  }

  async abrirPlantillaParaEditar(plantilla: RutinaPlantilla) {
    if (this.borradorPlantilla) {
      const ok = await this.confirm.confirm('Hay una plantilla sin guardar. ¿Descartar los cambios y abrir esta otra?');
      if (!ok) return;
    }
    // Copia profunda: editar el borrador no debe tocar la lista ya cargada
    // hasta que se guarde de verdad.
    this.borradorPlantilla = {
      nombre: plantilla.nombre,
      dias: plantilla.dias.map(d => ({
        dia: d.dia,
        enfoque: d.enfoque,
        ejercicios: d.ejercicios.map(e => ({ ...e }))
      }))
    };
    this.idPlantillaEditando = plantilla._id;
    this.diaActivo = plantilla.dias[0]?.dia || 'Lunes';
    this.cdr.detectChanges();
  }

  cerrarPlantilla() {
    this.borradorPlantilla = null;
    this.idPlantillaEditando = null;
    this.cdr.detectChanges();
  }

  /** Ejercicios del día abierto ahora mismo en el editor (array vivo). */
  get ejerciciosDiaActivo(): RutinaPlantillaEjercicio[] {
    return this.borradorPlantilla?.dias.find(d => d.dia === this.diaActivo)?.ejercicios || [];
  }

  get enfoqueDiaActivo(): string {
    return this.borradorPlantilla?.dias.find(d => d.dia === this.diaActivo)?.enfoque || '';
  }

  set enfoqueDiaActivo(valor: string) {
    const dia = this.asegurarDia(this.diaActivo);
    dia.enfoque = valor;
  }

  cuantosEjercicios(dia: string): number {
    return this.borradorPlantilla?.dias.find(d => d.dia === dia)?.ejercicios.length || 0;
  }

  /** Días que van a generar una rutina real (los que tienen ejercicios). */
  get diasConEjercicios(): RutinaPlantillaDia[] {
    return this.borradorPlantilla?.dias.filter(d => d.ejercicios.length) || [];
  }

  /** El día existe en el borrador, creándolo vacío si hacía falta. */
  private asegurarDia(dia: string): RutinaPlantillaDia {
    if (!this.borradorPlantilla) throw new Error('sin borrador');
    let entrada = this.borradorPlantilla.dias.find(d => d.dia === dia);
    if (!entrada) {
      entrada = { dia, enfoque: '', ejercicios: [] };
      this.borradorPlantilla.dias.push(entrada);
    }
    return entrada;
  }

  quitarDePlantilla(index: number) {
    const dia = this.borradorPlantilla?.dias.find(d => d.dia === this.diaActivo);
    dia?.ejercicios.splice(index, 1);
  }

  guardarPlantilla() {
    if (!this.borradorPlantilla || this.guardandoPlantilla) return;
    const nombre = this.borradorPlantilla.nombre.trim();
    if (!nombre) return this.toast.error('Ponele un nombre a la plantilla');
    if (!this.diasConEjercicios.length) return this.toast.error('Agregá ejercicios a al menos un día');

    this.guardandoPlantilla = true;
    const datos = { nombre, dias: this.diasConEjercicios };
    const peticion = this.idPlantillaEditando
      ? this.plantillaService.actualizar(this.idPlantillaEditando, datos)
      : this.plantillaService.crear(datos);

    peticion.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success(this.idPlantillaEditando ? 'Plantilla actualizada' : 'Plantilla guardada');
        this.guardandoPlantilla = false;
        this.cerrarPlantilla();
        this.cargarPlantillas();
      },
      error: (err) => { this.guardandoPlantilla = false; this.toast.error(err.error?.mensaje || 'Error al guardar la plantilla'); }
    });
  }

  /**
   * Asigna la semana entera de la plantilla al socio elegido arriba: una
   * rutina por cada día, de un solo toque. Si el socio ya tiene rutina en
   * alguno de esos días el backend responde 409 y recién ahí se pregunta si
   * se pisan — nunca se sobrescribe sin permiso.
   */
  usarPlantilla(plantilla: RutinaPlantilla, sobrescribir = false) {
    if (!this.usuarioId) return this.toast.error('Primero elegí el socio arriba');
    if (this.aplicandoPlantillaId) return;

    this.aplicandoPlantillaId = plantilla._id;
    this.plantillaService.aplicar(plantilla._id, this.usuarioId, sobrescribir)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.aplicandoPlantillaId = null;
          this.toast.success(res.mensaje);
          this.cargarRutinasDelSocio(this.usuarioId);
        },
        error: async (err) => {
          this.aplicandoPlantillaId = null;
          if (err.status === 409) {
            const dias = (err.error?.diasEnConflicto || []).join(', ');
            const ok = await this.confirm.confirm(
              `El socio ya tiene rutina en: ${dias}. ¿Reemplazarlas por las de "${plantilla.nombre}"?`
            );
            if (ok) this.usarPlantilla(plantilla, true);
            return;
          }
          this.toast.error(err.error?.mensaje || 'Error al asignar la plantilla');
        }
      });
  }

  async eliminarPlantilla(plantilla: RutinaPlantilla) {
    const ok = await this.confirm.confirm(`¿Eliminar la plantilla "${plantilla.nombre}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    this.plantillaService.eliminar(plantilla._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.toast.success('Plantilla eliminada');
          if (this.idPlantillaEditando === plantilla._id) this.cerrarPlantilla();
          this.cargarPlantillas();
        },
        error: (err) => this.toast.error(err.error?.mensaje || 'Error al eliminar la plantilla')
      });
  }

  onSocioChange() {
    if (this.usuarioId) this.cargarRutinasDelSocio(this.usuarioId);
  }

  /**
   * Al elegir un dia se abre la rutina que el socio ya tiene ESE dia, lista
   * para editar; si no tiene ninguna, el formulario queda limpio para crearla.
   *
   * No pide nada al servidor: `rutinasExistentesDelSocio` ya trae todas las
   * del socio desde que se lo eligio.
   */
  async onDiaChange() {
    if (!this.usuarioId || !this.dia) {
      this.diaAnterior = this.dia;
      return;
    }

    // Cambiar de dia reemplaza lo que haya en "Mi Selección". Si eso es un
    // borrador que el admin venia armando (y no una rutina traida del
    // servidor), se pierde sin aviso — de ahi la pregunta.
    if (!this.editandoModo && this.rutinaParaSocio.length > 0) {
      const ok = await this.confirm.confirm(
        'Tenés ejercicios sin guardar. ¿Descartarlos y abrir la rutina de ese día?'
      );
      if (!ok) {
        this.dia = this.diaAnterior;   // vuelve el selector a donde estaba
        this.cdr.detectChanges();
        return;
      }
    }

    this.diaAnterior = this.dia;
    const delDia = this.rutinasExistentesDelSocio.find(r => r.dia === this.dia);

    if (delDia) {
      this.editandoModo = true;
      this.idRutinaParaEditar = delDia._id;
      this.nombreRutina = delDia.nombre;
      this.enfoque = delDia.enfoque;
      this.rutinaParaSocio = [...delDia.ejercicios];
    } else {
      // Sin rutina ese dia: se limpia para crear una nueva, pero el socio y el
      // dia elegidos se conservan.
      this.limpiarFormulario();
      this.enfoque = '';
    }
    this.cdr.detectChanges();
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
              this.diaAnterior = encontrada.dia;
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
    const copia = {
      nombre: ej.nombre,
      imagenUrl: ej.imagenUrl || ej.gifUrl || '',
      instrucciones: ej.instrucciones ?? ej.tip ?? ej.descripcion ?? '',
      series: 4,
      repeticiones: '10'
    };
    // En modo plantilla el "+" del catálogo llena el día abierto en el
    // editor; si no, la rutina del socio como siempre.
    if (this.borradorPlantilla) {
      this.asegurarDia(this.diaActivo).ejercicios.push(copia);
      return;
    }

    // Con un puesto marcado para cambiar, el ejercicio entra AHI en vez de al
    // final: el orden de la rutina es el orden en que se entrena, asi que
    // cambiar el primero no puede mandarlo al ultimo lugar.
    if (this.reemplazandoIndice !== null) {
      const anterior = this.rutinaParaSocio[this.reemplazandoIndice];
      this.rutinaParaSocio[this.reemplazandoIndice] = {
        ...copia,
        // Se conservan las series y las repeticiones del puesto: lo que se
        // cambia es el ejercicio, no la carga que el admin ya definio ahi.
        series: anterior?.series ?? copia.series,
        repeticiones: anterior?.repeticiones ?? copia.repeticiones,
        completado: false
      };
      this.reemplazandoIndice = null;
      return;
    }

    this.rutinaParaSocio.push({ ...copia, completado: false });
  }

  /** Marca (o desmarca) el puesto que se va a cambiar por otro ejercicio. */
  cambiarEjercicio(index: number) {
    this.reemplazandoIndice = this.reemplazandoIndice === index ? null : index;
  }

  cancelarReemplazo() {
    this.reemplazandoIndice = null;
  }

  quitarDeRutina(index: number) {
    this.rutinaParaSocio.splice(index, 1);
    // El puesto marcado ya no existe o se corrio: se cancela para no escribir
    // sobre un ejercicio equivocado.
    this.reemplazandoIndice = null;
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
