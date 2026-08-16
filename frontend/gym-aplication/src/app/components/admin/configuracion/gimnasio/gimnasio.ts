import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { GymService, Gym } from '../../../../services/gym.service';
import { ConfiguracionService } from '../../../../services/configuracion.service';
import { ToastService } from '../../../../services/toast.service';
import { ThemeService } from '../../../../services/theme.service';

/** Módulos que el admin puede encender o apagar, con nombre legible. */
const MODULOS: { clave: keyof Gym['modulos']; nombre: string }[] = [
  { clave: 'noticias', nombre: 'Noticias' },
  { clave: 'rutinas', nombre: 'Rutinas' },
  { clave: 'progreso', nombre: 'Progreso' },
  { clave: 'medidas', nombre: 'Medidas corporales' },
  { clave: 'pagos', nombre: 'Planes y pagos' },
  { clave: 'cronometro', nombre: 'Cronómetro' }
];

@Component({
  selector: 'app-configuracion-gimnasio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './gimnasio.html',
  styleUrl: '../configuracion.css'
})
export class ConfiguracionGimnasio implements OnInit {
  private gymService = inject(GymService);
  private config = inject(ConfiguracionService);
  private toast = inject(ToastService);
  private theme = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);
  private location = inject(Location);

  gym: Gym | null = null;
  guardando = false;
  readonly modulos = MODULOS;

  ngOnInit(): void {
    // Copia local: así descartar los cambios es no guardar, sin tocar la sesión.
    const actual = this.gymService.getGym();
    this.gym = actual ? JSON.parse(JSON.stringify(actual)) : null;
  }

  // Se llega tanto desde el hub de Configuración como desde el enlace de
  // Página web: volver por historial, no a una ruta fija, para no saltarse
  // el paso intermedio cuando se entró desde ahí.
  volver(): void {
    this.location.back();
  }

  /** Redimensiona el logo antes de subirlo: se guarda como data URL en Mongo. */
  onLogoChange(event: any): void {
    const file = event.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e: any) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 200;
        const escala = MAX / Math.max(img.width, img.height);
        canvas.width = img.width * escala;
        canvas.height = img.height * escala;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        this.gym!.logo = canvas.toDataURL('image/jpeg', 0.85);
        this.cdr.detectChanges();
      };
    };
  }

  guardar(): void {
    if (!this.gym?._id || this.guardando) return;

    if (!this.gym.nombre?.trim()) {
      this.toast.error('El nombre del gimnasio es obligatorio');
      return;
    }

    this.guardando = true;
    this.config
      .guardarGimnasio(this.gym._id, {
        nombre: this.gym.nombre.trim(),
        slogan: this.gym.slogan,
        logo: this.gym.logo,
        colores: this.gym.colores,
        modulos: this.gym.modulos,
        spotifyPlaylist: this.gym.spotifyPlaylist || ''
      })
      .subscribe({
        next: (actualizado) => {
          this.gymService.guardarGym(actualizado);
          this.gym = JSON.parse(JSON.stringify(actualizado));
          // El color del navbar manda sobre todo el tema; hay que reaplicarlo
          // para que el cambio se vea sin recargar la app.
          this.theme.aplicar(actualizado);
          this.guardando = false;
          this.toast.success('Datos del gimnasio guardados');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.guardando = false;
          this.toast.error(err?.error?.error || 'No se pudo guardar');
          this.cdr.detectChanges();
        }
      });
  }
}
