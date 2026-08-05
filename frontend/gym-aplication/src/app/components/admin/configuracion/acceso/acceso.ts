import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ConfiguracionService, Dispositivo } from '../../../../services/configuracion.service';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../services/confirm.service';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-configuracion-acceso',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './acceso.html',
  styleUrl: '../configuracion.css'
})
export class ConfiguracionAcceso implements OnInit {
  private config = inject(ConfiguracionService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private cdr = inject(ChangeDetectorRef);

  equipos: Dispositivo[] = [];
  cargando = false;
  guardando = false;
  mostrarForm = false;

  nombre = '';
  serie = '';
  marca = 'zkteco';

  readonly marcas = [
    { valor: 'zkteco', nombre: 'ZKTeco' },
    { valor: 'hikvision', nombre: 'Hikvision' },
    { valor: 'suprema', nombre: 'Suprema' },
    { valor: 'anviz', nombre: 'Anviz' },
    { valor: 'otro', nombre: 'Otra' }
  ];

  /** Dirección que el admin debe teclear en el menú del lector. */
  readonly urlServidor = `${environment.apiUrl}/api/dispositivos`;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.config.dispositivos().subscribe({
      next: (res) => {
        this.equipos = res || [];
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.toast.error('No se pudieron cargar los equipos');
        this.cdr.detectChanges();
      }
    });
  }

  agregar(): void {
    if (this.guardando) return;
    if (!this.nombre.trim()) {
      this.toast.error('Ponle un nombre al equipo');
      return;
    }
    if (!/^[A-Za-z0-9-]{4,32}$/.test(this.serie.trim())) {
      this.toast.error('La serie debe tener entre 4 y 32 letras, números o guiones');
      return;
    }

    this.guardando = true;
    this.config
      .crearDispositivo({ nombre: this.nombre.trim(), serie: this.serie.trim(), marca: this.marca })
      .subscribe({
        next: (equipo) => {
          this.equipos = [equipo, ...this.equipos];
          this.guardando = false;
          this.mostrarForm = false;
          this.nombre = this.serie = '';
          this.toast.success('Equipo registrado');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.guardando = false;
          this.toast.error(err?.error?.error || 'No se pudo registrar el equipo');
          this.cdr.detectChanges();
        }
      });
  }

  alternar(equipo: Dispositivo): void {
    this.config.actualizarDispositivo(equipo._id, { activo: !equipo.activo }).subscribe({
      next: (actualizado) => {
        equipo.activo = actualizado.activo;
        this.toast.success(actualizado.activo ? 'Equipo activado' : 'Equipo desactivado');
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('No se pudo cambiar el estado')
    });
  }

  async eliminar(equipo: Dispositivo): Promise<void> {
    const ok = await this.confirm.confirm(
      `¿Dar de baja "${equipo.nombre}"? Sus marcaciones dejarán de registrarse.`
    );
    if (!ok) return;

    this.config.eliminarDispositivo(equipo._id).subscribe({
      next: () => {
        this.equipos = this.equipos.filter((e) => e._id !== equipo._id);
        this.toast.success('Equipo dado de baja');
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('No se pudo eliminar el equipo')
    });
  }

  /** Texto del estado: en espera mientras el aparato no haya marcado nunca. */
  estado(equipo: Dispositivo): { texto: string; clase: string } {
    if (!equipo.activo) return { texto: 'Desactivado', clase: 'estado--off' };
    if (!equipo.ultimaConexion) return { texto: 'Esperando primera marcación', clase: 'estado--espera' };
    return { texto: 'Conectado', clase: 'estado--ok' };
  }
}
