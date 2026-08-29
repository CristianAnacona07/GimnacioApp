import { Component, EventEmitter, HostListener, Input, Output, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { CamaraFoto } from '../camara-foto/camara-foto';

/**
 * Un único botón para cambiar una foto, con sus dos caminos: subir un archivo
 * o tomarla con la cámara.
 *
 * Antes cada pantalla resolvía esto por su cuenta y el resultado era confuso:
 * había que descubrir que la imagen era cliqueable, y al lado un botón de
 * cámara que parecía otra función. Acá la decisión aparece recién cuando ya
 * decidiste cambiar la foto.
 *
 * En el celular y en el APK el menú sobra: el selector del sistema ya pregunta
 * "¿cámara o galería?", así que el botón va directo y se ahorra un paso.
 *
 * Emite la foto como data URL sin reducir; cada pantalla la deja del tamaño que
 * necesite (200 px un avatar, 1600 px una portada).
 */
@Component({
  selector: 'app-selector-foto',
  standalone: true,
  imports: [CommonModule, CamaraFoto],
  templateUrl: './selector-foto.html',
  styleUrl: './selector-foto.css'
})
export class SelectorFoto {
  /** Texto del botón. */
  @Input() etiqueta = 'Cambiar foto';
  /** Foto elegida, venga del archivo o de la cámara. */
  @Output() elegida = new EventEmitter<string>();

  private cdr = inject(ChangeDetectorRef);

  readonly esNativo = Capacitor.isNativePlatform();
  /** En nativo el input necesita `capture` para que Capacitor ofrezca la cámara. */
  readonly captura = this.esNativo ? 'environment' : null;

  menuAbierto = false;
  camaraAbierta = false;
  /** Id propio: puede haber varios selectores en la misma pantalla. */
  readonly idInput = 'foto-' + Math.random().toString(36).slice(2, 9);

  /** En nativo no hay menú que mostrar: el sistema ya da las dos opciones. */
  alPulsar(): void {
    if (this.esNativo) this.abrirArchivos();
    else this.menuAbierto = !this.menuAbierto;
  }

  abrirArchivos(): void {
    this.menuAbierto = false;
    document.getElementById(this.idInput)?.click();
  }

  abrirCamara(): void {
    this.menuAbierto = false;
    this.camaraAbierta = true;
  }

  alElegirArchivo(evento: any): void {
    const archivo = evento?.target?.files?.[0];
    if (!archivo) return;
    // Deja el input listo para volver a elegir el mismo archivo.
    evento.target.value = '';
    const lector = new FileReader();
    lector.onload = (e: any) => {
      this.elegida.emit(e.target.result);
      this.cdr.detectChanges();
    };
    lector.readAsDataURL(archivo);
  }

  alTomarFoto(dataUrl: string): void {
    this.camaraAbierta = false;
    this.elegida.emit(dataUrl);
  }

  /** Un clic fuera cierra el menú, como cualquier desplegable. */
  @HostListener('document:click', ['$event'])
  alClicFuera(evento: MouseEvent): void {
    if (!this.menuAbierto) return;
    const destino = evento.target as HTMLElement;
    if (!destino.closest('app-selector-foto')) {
      this.menuAbierto = false;
      this.cdr.detectChanges();
    }
  }
}
