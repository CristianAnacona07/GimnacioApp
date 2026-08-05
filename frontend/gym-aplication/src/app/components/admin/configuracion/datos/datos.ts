import { Component, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConfiguracionService, ResultadoImportacion } from '../../../../services/configuracion.service';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../services/confirm.service';

/**
 * Exportar los datos del gimnasio a CSV e importar socios desde uno.
 * Es lo que permite a un gimnasio migrar desde otro sistema (o desde su Excel
 * de siempre) sin teclear cada socio a mano.
 */
@Component({
  selector: 'app-configuracion-datos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './datos.html',
  styleUrl: '../configuracion.css'
})
export class ConfiguracionDatos {
  private config = inject(ConfiguracionService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private cdr = inject(ChangeDetectorRef);

  exportando: 'usuarios' | 'transacciones' | null = null;
  importando = false;
  resultado: ResultadoImportacion | null = null;

  exportarUsuarios(): void {
    if (this.exportando) return;
    this.exportando = 'usuarios';
    this.config.exportarUsuarios().subscribe({
      next: (blob) => this.descargaLista(blob, 'socios.csv'),
      error: () => this.falloExport()
    });
  }

  exportarTransacciones(): void {
    if (this.exportando) return;
    this.exportando = 'transacciones';
    this.config.exportarTransacciones().subscribe({
      next: (blob) => this.descargaLista(blob, 'transacciones.csv'),
      error: () => this.falloExport()
    });
  }

  private descargaLista(blob: Blob, nombre: string): void {
    this.config.descargar(blob, nombre);
    this.exportando = null;
    this.toast.success('Archivo descargado');
    this.cdr.detectChanges();
  }

  private falloExport(): void {
    this.exportando = null;
    this.toast.error('No se pudo generar el archivo');
    this.cdr.detectChanges();
  }

  /** Lee el CSV en el navegador y lo manda como texto: el backend lo parsea. */
  async onArchivo(event: any): Promise<void> {
    const file = event.target?.files?.[0];
    if (!file || this.importando) return;

    const csv = await file.text();
    // Se avisa antes porque importar crea socios de verdad, y deshacerlo a mano
    // es tedioso si el archivo venía mal.
    const filas = Math.max(0, csv.split(/\r\n|\r|\n/).filter((l: string) => l.trim()).length - 1);
    const ok = await this.confirm.confirm(
      `El archivo tiene ${filas} fila${filas === 1 ? '' : 's'} de socios. ` +
      `Se crearán en tu gimnasio. ¿Continuar?`
    );
    event.target.value = ''; // permite volver a elegir el mismo archivo
    if (!ok) return;

    this.importando = true;
    this.resultado = null;
    this.cdr.detectChanges();

    this.config.importarUsuarios(csv).subscribe({
      next: (res) => {
        this.importando = false;
        this.resultado = res;
        this.toast.success(`${res.creados} socio(s) importado(s)`);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.importando = false;
        this.toast.error(err?.error?.error || 'No se pudo importar el archivo');
        this.cdr.detectChanges();
      }
    });
  }
}
