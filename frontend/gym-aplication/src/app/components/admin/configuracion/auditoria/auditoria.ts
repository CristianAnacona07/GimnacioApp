import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConfiguracionService, RegistroAuditoria } from '../../../../services/configuracion.service';
import { ToastService } from '../../../../services/toast.service';

/** Traducción de los códigos de acción a algo legible por un dueño de gimnasio. */
const ETIQUETAS: Record<string, string> = {
  REGISTRAR_PAGO: 'Registró un pago',
  RENOVAR_MEMBRESIA: 'Renovó una membresía',
  CREAR_PLAN: 'Creó un plan',
  EDITAR_PLAN: 'Editó un plan',
  ELIMINAR_PLAN: 'Eliminó un plan',
  EDITAR_GYM: 'Cambió la configuración del gimnasio',
  ACTIVAR_2FA: 'Activó la verificación en dos pasos',
  CAMBIAR_PASSWORD: 'Cambió su contraseña',
  REGISTRAR_DISPOSITIVO: 'Registró un equipo de acceso',
  EDITAR_DISPOSITIVO: 'Editó un equipo de acceso',
  ELIMINAR_DISPOSITIVO: 'Eliminó un equipo de acceso'
};

@Component({
  selector: 'app-configuracion-auditoria',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './auditoria.html',
  styleUrl: '../configuracion.css'
})
export class ConfiguracionAuditoria implements OnInit {
  private config = inject(ConfiguracionService);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  registros: RegistroAuditoria[] = [];
  cargando = false;
  page = 1;
  pages = 1;
  total = 0;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.config.auditoria(this.page, 20).subscribe({
      next: (res) => {
        this.registros = res.data || [];
        this.pages = res.pages || 1;
        this.total = res.total || 0;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.toast.error('No se pudo cargar la auditoría');
        this.cdr.detectChanges();
      }
    });
  }

  ir(delta: number): void {
    const destino = this.page + delta;
    if (destino < 1 || destino > this.pages || this.cargando) return;
    this.page = destino;
    this.cargar();
  }

  /** Texto legible; si la acción es nueva y no está mapeada, se muestra cruda. */
  etiqueta(accion: string): string {
    return ETIQUETAS[accion] || accion;
  }

  /** Resumen corto del detalle, sin volcar el JSON entero en pantalla. */
  resumen(registro: RegistroAuditoria): string {
    const d = registro.detalle;
    if (!d || typeof d !== 'object') return '';
    return Object.entries(d)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
  }
}
