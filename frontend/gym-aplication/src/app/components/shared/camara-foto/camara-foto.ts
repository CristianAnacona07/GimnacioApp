import {
  ChangeDetectorRef, Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Tomar una foto con la cámara del equipo.
 *
 * En un celular el propio `<input type="file">` ya ofrece la cámara, pero en un
 * computador no: ahí la única vía es `getUserMedia`. Este componente es esa vía
 * y emite la foto como data URL, con la misma forma que devuelve el selector de
 * archivos, así quien lo usa no distingue de dónde salió.
 *
 * Requiere contexto seguro (HTTPS o localhost); en cualquier otro origen el
 * navegador ni siquiera expone `mediaDevices`.
 */
@Component({
  selector: 'app-camara-foto',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './camara-foto.html',
  styleUrl: './camara-foto.css'
})
export class CamaraFoto implements OnInit, OnDestroy {
  /** Foto tomada, como data URL JPEG. */
  @Output() capturada = new EventEmitter<string>();
  /** El usuario cerró sin tomar nada. */
  @Output() cancelada = new EventEmitter<void>();

  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  private cdr = inject(ChangeDetectorRef);
  private flujo: MediaStream | null = null;

  cargando = true;
  error: string | null = null;

  async ngOnInit(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.fallar('Este navegador no permite usar la cámara. Probá con Chrome o Edge, o subí una foto desde el archivo.');
      return;
    }
    try {
      this.flujo = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      this.cargando = false;
      this.cdr.detectChanges();
      // El <video> recién existe cuando la plantilla deja de mostrar "cargando".
      if (this.videoRef) {
        this.videoRef.nativeElement.srcObject = this.flujo;
        await this.videoRef.nativeElement.play().catch(() => {});
      }
    } catch (e: any) {
      const nombre = e?.name || '';
      if (nombre === 'NotAllowedError') {
        this.fallar('No diste permiso para usar la cámara. Habilitalo en el candado de la barra de direcciones.');
      } else if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') {
        this.fallar('No se encontró ninguna cámara conectada.');
      } else if (nombre === 'NotReadableError') {
        this.fallar('La cámara está siendo usada por otro programa. Cerralo e intentá de nuevo.');
      } else {
        this.fallar('No se pudo abrir la cámara.');
      }
    }
  }

  private fallar(mensaje: string): void {
    this.error = mensaje;
    this.cargando = false;
    this.cdr.detectChanges();
  }

  tomar(): void {
    const video = this.videoRef?.nativeElement;
    if (!video || !video.videoWidth) return;

    const lienzo = document.createElement('canvas');
    lienzo.width = video.videoWidth;
    lienzo.height = video.videoHeight;
    lienzo.getContext('2d')?.drawImage(video, 0, 0);
    // Sin reducir: cada pantalla decide después qué tamaño necesita (200 px
    // para una foto de perfil, más para una portada).
    this.capturada.emit(lienzo.toDataURL('image/jpeg', 0.9));
    this.detener();
  }

  cerrar(): void {
    this.cancelada.emit();
    this.detener();
  }

  /** Apagar la cámara: si el stream queda vivo, la luz del equipo sigue encendida. */
  private detener(): void {
    this.flujo?.getTracks().forEach((pista) => pista.stop());
    this.flujo = null;
  }

  ngOnDestroy(): void {
    this.detener();
  }
}
