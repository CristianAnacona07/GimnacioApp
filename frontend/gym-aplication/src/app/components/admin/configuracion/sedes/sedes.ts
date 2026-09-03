import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SedeService, Sede } from '../../../../services/sede.service';
import { ToastService } from '../../../../services/toast.service';

/**
 * Los locales del gimnasio.
 *
 * Crear una sede NO es crear un gimnasio: no tiene plan, ni factura, ni base de
 * socios aparte. Por eso esto lo maneja el administrador, mientras que dar de
 * alta gimnasios sigue siendo del superadmin.
 */
@Component({
  selector: 'app-configuracion-sedes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sedes.html',
  styleUrl: '../configuracion.css'
})
export class ConfiguracionSedes implements OnInit {
  private sedeService = inject(SedeService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  /** Todas, incluida la principal: hace falta para saber si ya hay alguna. */
  todas: Sede[] = [];

  /**
   * Las que el admin puede manejar. La principal queda afuera: representa al
   * gimnasio en sí, que crea el superadmin, y no se edita ni se desactiva
   * desde acá — desactivarla dejaría al gimnasio sin su local original.
   */
  get sedes(): Sede[] { return this.todas.filter(s => !s.esPrincipal); }
  cargando = false;
  guardando = false;

  // Formulario: sirve para crear y para editar; `editandoId` distingue.
  mostrarForm = false;
  editandoId: string | null = null;
  nombre = '';
  adminNombre = '';
  adminEmail = '';
  direccion = '';
  telefono = '';

  /** Quién administra la sede que se está editando. */
  get adminDeLaSede(): { nombre: string; email: string } | null {
    return this.todas.find(s => s._id === this.editandoId)?.admin || null;
  }

  /** Todavía no abrió un segundo local. */
  get esPrimera(): boolean { return this.todas.length === 0; }

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargando = true;
    this.sedeService.cargar(true).subscribe({
      next: (s) => { this.todas = s || []; this.cargando = false; this.cdr.detectChanges(); },
      error: () => {
        this.cargando = false;
        this.toast.error('No se pudieron cargar las sedes');
        this.cdr.detectChanges();
      }
    });
  }

  abrirNueva(): void {
    this.editandoId = null;
    this.nombre = ''; this.direccion = ''; this.telefono = '';
    this.adminNombre = ''; this.adminEmail = '';
    this.mostrarForm = true;
  }

  abrirEdicion(s: Sede): void {
    this.editandoId = s._id;
    this.nombre = s.nombre;
    this.direccion = s.direccion || '';
    this.telefono = s.telefono || '';
    this.mostrarForm = true;
  }

  cancelar(): void {
    this.mostrarForm = false;
    this.editandoId = null;
  }

  guardar(): void {
    const nombre = this.nombre.trim();
    if (!nombre) { this.toast.error('Escribe el nombre de la sede'); return; }
    if (this.guardando) return;

    this.guardando = true;
    const datos: any = { nombre, direccion: this.direccion.trim(), telefono: this.telefono.trim() };
    // Sólo se manda si escribió algo: si va vacío, la sede queda sin
    // administrador propio y no se crea ningún usuario.
    if (!this.editandoId && (this.adminNombre.trim() || this.adminEmail.trim())) {
      datos.admin = { nombre: this.adminNombre.trim(), email: this.adminEmail.trim() };
    }
    const peticion = this.editandoId
      ? this.sedeService.editar(this.editandoId, datos)
      : this.sedeService.crear(datos);

    const editaba = !!this.editandoId;

    peticion.subscribe({
      next: (r: any) => {
        this.guardando = false;
        this.mostrarForm = false;
        this.editandoId = null;
        // Al agregar la segunda sede el backend convierte el local que ya
        // existía en una sede y devuelve cuál creó, para poder nombrarla.
        const principal = r?.principalCreada?.nombre;
        const adm = r?.admin;
        if (adm) {
          // Si el correo no salió, la clave se muestra para dictarla: es la
          // única vez que existe en claro.
          this.toast.success(adm.correoEnviado
            ? `Le mandamos la contraseña a ${adm.email}`
            : `No salió el correo. Contraseña de ${adm.email}: ${adm.password}`);
        }
        this.toast.success(
          editaba ? 'Sede actualizada'
            : principal ? `Sede creada. Tu local anterior quedó como "${principal}".`
              : 'Sede creada'
        );
        this.cargar();
      },
      error: (e) => {
        this.guardando = false;
        this.toast.error(e?.error?.error || 'No se pudo guardar la sede');
        this.cdr.detectChanges();
      }
    });
  }

  desactivar(s: Sede): void {
    if (!confirm(`¿Desactivar la sede "${s.nombre}"? Su historial de entradas se conserva.`)) return;
    this.sedeService.desactivar(s._id).subscribe({
      next: () => { this.toast.success('Sede desactivada'); this.cargar(); },
      error: () => this.toast.error('No se pudo desactivar')
    });
  }
}
