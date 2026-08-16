import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { GymService, Gym, Landing, landingVacia, normalizarLanding } from '../../../../services/gym.service';
import { ConfiguracionService } from '../../../../services/configuracion.service';
import { LandingService } from '../../../../services/landing.service';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../services/confirm.service';

/** Ancho máximo al que se reducen las fotos antes de subirlas. */
const ANCHO_MAX = 1600;

/**
 * Editor de la página pública del gimnasio.
 *
 * Trabaja sobre una copia del gym: descartar los cambios es simplemente no
 * guardar. Las fotos son la excepción — se suben al almacén en el momento de
 * elegirlas, porque el editor guarda URLs, no archivos.
 */
@Component({
  selector: 'app-configuracion-pagina',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './pagina.html',
  // Reusa los estilos comunes de Configuración y añade solo lo propio del editor.
  styleUrls: ['../configuracion.css', './pagina.css']
})
export class ConfiguracionPagina implements OnInit {
  private gymService = inject(GymService);
  private config = inject(ConfiguracionService);
  private landingService = inject(LandingService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private cdr = inject(ChangeDetectorRef);

  gym: Gym | null = null;
  landing: Landing = landingVacia();
  guardando = false;
  /** Qué imagen se está subiendo, para mostrar el "Subiendo…" en su sitio. */
  subiendo: string | null = null;

  ngOnInit(): void {
    const actual = this.gymService.getGym();
    this.gym = actual ? JSON.parse(JSON.stringify(actual)) : null;
    // Un gimnasio creado antes de esta función no trae el campo landing, y uno
    // guardado a medias lo trae incompleto: normalizar evita ambos casos.
    this.landing = normalizarLanding(this.gym?.landing);
  }

  /** Dirección pública, la que el gimnasio comparte con la gente. */
  get enlace(): string {
    return this.gym ? `${window.location.origin}/g/${this.gym.slug}` : '';
  }

  copiarEnlace(): void {
    navigator.clipboard.writeText(this.enlace)
      .then(() => this.toast.success('Enlace copiado'))
      .catch(() => this.toast.error('No se pudo copiar'));
  }

  verPagina(): void {
    window.open(this.enlace, '_blank');
  }

  // ── Fotos ─────────────────────────────────────────────────────────────────

  /**
   * Reduce la imagen en el navegador antes de mandarla: subir una foto de 6 MB
   * recién salida del celular sería lento y no se vería mejor.
   */
  private redimensionar(archivo: File): Promise<string> {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onerror = () => rechazar(new Error('No se pudo leer el archivo'));
      lector.onload = (e: any) => {
        const img = new Image();
        img.onerror = () => rechazar(new Error('El archivo no es una imagen válida'));
        img.onload = () => {
          const escala = Math.min(1, ANCHO_MAX / Math.max(img.width, img.height));
          const lienzo = document.createElement('canvas');
          lienzo.width = Math.round(img.width * escala);
          lienzo.height = Math.round(img.height * escala);
          lienzo.getContext('2d')?.drawImage(img, 0, 0, lienzo.width, lienzo.height);
          resolver(lienzo.toDataURL('image/jpeg', 0.82));
        };
        img.src = e.target.result;
      };
      lector.readAsDataURL(archivo);
    });
  }

  private async subir(evento: any, campo: string): Promise<string | null> {
    const archivo = evento?.target?.files?.[0];
    if (!archivo) return null;
    // Deja el input listo para volver a elegir la misma foto si hace falta.
    evento.target.value = '';

    this.subiendo = campo;
    this.cdr.detectChanges();
    try {
      const dataUrl = await this.redimensionar(archivo);
      const res = await new Promise<{ url: string }>((ok, mal) =>
        this.landingService.subirImagen(dataUrl).subscribe({ next: ok, error: mal })
      );
      return res.url;
    } catch (e: any) {
      this.toast.error(e?.error?.mensaje || e?.message || 'No se pudo subir la imagen');
      return null;
    } finally {
      this.subiendo = null;
      this.cdr.detectChanges();
    }
  }

  async cambiarPortada(evento: any): Promise<void> {
    const url = await this.subir(evento, 'portada');
    if (url) { this.landing.portada.imagen = url; this.cdr.detectChanges(); }
  }

  async cambiarFotoNosotros(evento: any): Promise<void> {
    const url = await this.subir(evento, 'nosotros');
    if (url) { this.landing.sobreNosotros.imagen = url; this.cdr.detectChanges(); }
  }

  async agregarFotoGaleria(evento: any): Promise<void> {
    const url = await this.subir(evento, 'galeria');
    if (url) { this.landing.galeria.fotos.push({ url, descripcion: '' }); this.cdr.detectChanges(); }
  }

  async quitarFoto(indice: number): Promise<void> {
    const ok = await this.confirm.confirm('¿Quitar esta foto de la galería?');
    if (!ok) return;
    const [fuera] = this.landing.galeria.fotos.splice(indice, 1);
    // Borrar el archivo es limpieza: si falla, la foto ya no se muestra igual.
    if (fuera?.url) this.landingService.eliminarImagen(fuera.url).subscribe({ error: () => {} });
    this.cdr.detectChanges();
  }

  // ── Horarios ──────────────────────────────────────────────────────────────

  agregarHorario(): void {
    this.landing.horarios.filas.push({ dias: '', horas: '' });
  }

  quitarHorario(indice: number): void {
    this.landing.horarios.filas.splice(indice, 1);
  }

  // ── Guardar ───────────────────────────────────────────────────────────────

  guardar(): void {
    if (!this.gym?._id || this.guardando) return;
    this.guardando = true;
    this.config.guardarGimnasio(this.gym._id, { landing: this.landing } as any).subscribe({
      next: (actualizado) => {
        this.guardando = false;
        // El gym en memoria queda al día para que el enlace y los colores no
        // se queden con lo anterior si el admin sigue navegando.
        this.gymService.guardarGym(actualizado);
        this.toast.success(this.landing.activa ? 'Página guardada y publicada' : 'Página guardada');
        this.cdr.detectChanges();
      },
      error: () => {
        this.guardando = false;
        this.toast.error('No se pudo guardar la página');
        this.cdr.detectChanges();
      }
    });
  }
}
