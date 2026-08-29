import { ApplicationRef, ChangeDetectorRef, Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SelectorFoto } from '../../../shared/selector-foto/selector-foto';

import { GymService, Gym, Landing, landingVacia, normalizarLanding } from '../../../../services/gym.service';
import { ConfiguracionService } from '../../../../services/configuracion.service';
import { LandingService } from '../../../../services/landing.service';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../services/confirm.service';

/** Ancho máximo al que se reducen las fotos antes de subirlas. */
const ANCHO_MAX = 1600;

/**
 * Tope para los GIF, que viajan sin reducir. El cuerpo de la petición admite
 * 10 MB y el data URL infla el archivo un tercio al codificarlo en base64, así
 * que 6 MB de GIF son ~8 MB de JSON: por encima de eso la petición ni sale.
 */
const GIF_MAX_BYTES = 6 * 1024 * 1024;

/**
 * Alto de la barra fija del sitio (56 px de logo mas su relleno). La foto puede
 * bajar hasta esa linea: el hueco que deja arriba queda debajo del menu, asi
 * que nadie lo ve.
 */
const ALTO_BARRA = 83;

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
  imports: [CommonModule, FormsModule, RouterModule, SelectorFoto],
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
  private appRef = inject(ApplicationRef);

  gym: Gym | null = null;
  landing: Landing = landingVacia();

  /**
   * Copia de lo ultimo guardado, para saber si de verdad cambio algo. Se
   * compara serializada porque la pagina es un objeto anidado que se edita por
   * todos lados: encuadre, secciones, tarjetas, horarios.
   */
  private guardadoEnServidor = '';

  get hayCambios(): boolean {
    return JSON.stringify(this.landing) !== this.guardadoEnServidor;
  }

  private marcarGuardado(): void {
    this.guardadoEnServidor = JSON.stringify(this.landing);
  }
  guardando = false;
  /** Qué imagen se está subiendo, para mostrar el "Subiendo…" en su sitio. */
  subiendo: string | null = null;

  /**
   * La app corre sin zone.js: nada avisa a Angular cuando termina una promesa,
   * asi que tras subir una foto hay que pedir el repintado a mano. Con solo
   * `detectChanges()` la vista previa aparecia recien al hacer clic en
   * cualquier parte, que es lo que devolvia el siguiente evento a Angular.
   */
  private refrescar(): void {
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    this.appRef.tick();
  }

  ngOnInit(): void {
    const actual = this.gymService.getGym();
    this.gym = actual ? JSON.parse(JSON.stringify(actual)) : null;
    // Un gimnasio creado antes de esta función no trae el campo landing, y uno
    // guardado a medias lo trae incompleto: normalizar evita ambos casos.
    this.landing = normalizarLanding(this.gym?.landing);
    this.recalcularProporcion();
    this.leerFoco();
    this.marcarGuardado();
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
  /** Bytes que ocupa un data URL: base64 infla el archivo un tercio. */
  private pesoAproximado(dataUrl: string): number {
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return Math.floor((base64.length * 3) / 4);
  }

  private reducirDataUrl(dataUrl: string): Promise<string> {
    return new Promise((resolver, rechazar) => {
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
      img.src = dataUrl;
    });
  }

  /**
   * Foto elegida para una sección, venga de un archivo o de la cámara: se
   * reduce, se sube al almacén y la sección se queda con la URL.
   */
  async usarFoto(campo: string, dataUrl: string): Promise<void> {
    // Un GIF animado no puede pasar por el canvas: `drawImage` copia un solo
    // fotograma y llegaria una foto quieta. Se sube tal cual, con su propio
    // tope, ya que nadie lo va a reducir.
    const esGif = dataUrl.startsWith('data:image/gif');
    if (esGif && this.pesoAproximado(dataUrl) > GIF_MAX_BYTES) {
      this.toast.error('El GIF supera los 6 MB. Probá con uno más liviano o más corto.');
      return;
    }

    this.subiendo = campo;
    this.refrescar();
    try {
      const reducida = esGif ? dataUrl : await this.reducirDataUrl(dataUrl);
      const res = await new Promise<{ url: string }>((ok, mal) =>
        this.landingService.subirImagen(reducida).subscribe({ next: ok, error: mal })
      );
      if (campo === 'portada') this.landing.portada.imagen = res.url;
      else if (campo === 'nosotros') this.landing.sobreNosotros.imagen = res.url;
      else {
        // 'tarjeta:<indiceSeccion>:<indiceTarjeta>'
        const [, iSec, iTar] = campo.split(':').map(Number);
        const tarjeta = this.landing.secciones[iSec]?.tarjetas[iTar];
        if (tarjeta) tarjeta.imagen = res.url;
      }
    } catch (e: any) {
      this.toast.error(e?.error?.mensaje || e?.message || 'No se pudo subir la foto');
    } finally {
      this.subiendo = null;
      this.refrescar();
    }
  }







  // ── Encuadre de la portada ────────────────────────────────────────────────

  /**
   * La portada tiene alto fijo y la foto se recorta para llenarla. En vez de
   * conformarse con el centro, el gimnasio arrastra la vista previa y elige qué
   * parte queda a la vista: se guarda como `object-position`.
   */
  /**
   * La vista previa imita la portada real: mismo alto (94svh) y mismo ancho de
   * pantalla, asi lo que se encuadra aca es lo que se publica. Se recalcula al
   * cambiar el tamaño de la ventana, porque esa proporcion depende de cada
   * pantalla.
   */
  proporcionPortada = 16 / 9;

  @HostListener('window:resize')
  recalcularProporcion(): void {
    const alto = window.innerHeight * 0.94;
    this.proporcionPortada = alto > 0 ? window.innerWidth / alto : 16 / 9;
    this.cdr.detectChanges();
  }

  private arrastrando = false;
  private ultimo = { x: 0, y: 0 };
  /**
   * El encuadre se lleva con decimales aunque se guarde redondeado. Antes se
   * recalculaba a partir del valor ya redondeado y, como cada pixel de arrastre
   * mueve ~0,12 %, el redondeo se comia el movimiento: arrastrando despacio la
   * foto no se movia nunca.
   */
  private foco = { x: 50, y: 50 };
  /** Pixeles extra hacia abajo, entre 0 y el alto de la barra. */
  private desplazamiento = 0;

  get desplazamientoPortada(): number {
    return this.desplazamiento;
  }

  get posicionPortada(): string {
    return `${this.foco.x.toFixed(1)}% ${this.foco.y.toFixed(1)}%`;
  }

  /** Lee lo guardado al abrir la pantalla. */
  private leerFoco(): void {
    const [x, y] = (this.landing.portada.posicion || '50% 50%')
      .split(' ')
      .map((v) => parseFloat(v));
    this.foco = { x: isNaN(x) ? 50 : x, y: isNaN(y) ? 50 : y };
    this.desplazamiento = this.landing.portada.desplazamiento || 0;
  }

  empezarArrastre(evento: PointerEvent): void {
    if (!this.landing.portada.imagen) return;
    this.arrastrando = true;
    this.ultimo = { x: evento.clientX, y: evento.clientY };
    (evento.target as HTMLElement).setPointerCapture?.(evento.pointerId);
    evento.preventDefault();
  }

  moverEncuadre(evento: PointerEvent): void {
    if (!this.arrastrando) return;
    const caja = (evento.currentTarget as HTMLElement).getBoundingClientRect();
    // Arrastrar hacia abajo muestra lo de arriba, como correr una hoja bajo una
    // ventana: de ahi que se reste.
    const dx = evento.clientX - this.ultimo.x;
    const dy = evento.clientY - this.ultimo.y;
    this.ultimo = { x: evento.clientX, y: evento.clientY };

    this.foco.x = Math.min(100, Math.max(0, this.foco.x - (dx / caja.width) * 100));

    // Vertical en dos tramos: primero se recorre la foto y, cuando llega a su
    // borde de arriba, empieza a bajar hacia la linea del menu.
    let y = this.foco.y - (dy / caja.height) * 100;
    if (y < 0) {
      // Lo que sobra del recorrido se convierte en pixeles hacia abajo.
      const sobra = (-y / 100) * caja.height;
      this.desplazamiento = Math.min(ALTO_BARRA, this.desplazamiento + sobra);
      y = 0;
    } else if (this.desplazamiento > 0 && dy < 0) {
      // Volviendo hacia arriba se deshace primero ese empujon.
      const sobra = Math.min(this.desplazamiento, -dy);
      this.desplazamiento -= sobra;
      y = this.foco.y;
    }
    this.foco.y = Math.min(100, Math.max(0, y));

    this.landing.portada.posicion = this.posicionPortada;
    this.landing.portada.desplazamiento = Math.round(this.desplazamiento);
    // Durante el arrastre alcanza con repintar esta vista: un ciclo completo en
    // cada movimiento del mouse hace que se sienta trabada.
    this.cdr.detectChanges();
  }

  terminarArrastre(): void {
    this.arrastrando = false;
  }

  centrarPortada(): void {
    this.foco = { x: 50, y: 50 };
    this.desplazamiento = 0;
    this.landing.portada.posicion = this.posicionPortada;
    this.landing.portada.desplazamiento = 0;
    this.refrescar();
  }

  // ── Secciones ─────────────────────────────────────────────────────────────

  /**
   * Crear una sección crea también su botón en el menú de la página: el nombre
   * es lo único que hace falta, todo lo demás sale de las tarjetas.
   */
  agregarSeccion(): void {
    this.landing.secciones.push({
      id: Math.random().toString(36).slice(2, 10),
      nombre: '',
      tarjetas: []
    });
    this.refrescar();
  }

  async quitarSeccion(indice: number): Promise<void> {
    const nombre = this.landing.secciones[indice]?.nombre?.trim();
    const ok = await this.confirm.confirm(
      nombre ? `¿Quitar la sección "${nombre}" y todas sus tarjetas?` : '¿Quitar esta sección?'
    );
    if (!ok) return;
    const [fuera] = this.landing.secciones.splice(indice, 1);
    // Las fotos que ya no muestra nadie se borran del almacén; si falla, la
    // sección igual desapareció.
    for (const t of fuera?.tarjetas || []) {
      if (t.imagen) this.landingService.eliminarImagen(t.imagen).subscribe({ error: () => {} });
    }
    this.refrescar();
  }

  /** El orden de las secciones es el del menú y el de la página. */
  moverSeccion(indice: number, salto: number): void {
    const destino = indice + salto;
    if (destino < 0 || destino >= this.landing.secciones.length) return;
    const [fuera] = this.landing.secciones.splice(indice, 1);
    this.landing.secciones.splice(destino, 0, fuera);
    this.refrescar();
  }

  agregarTarjeta(indice: number): void {
    this.landing.secciones[indice].tarjetas.push({ imagen: '', titulo: '', descripcion: '', precio: '' });
    this.refrescar();
  }

  async quitarTarjeta(iSec: number, iTar: number): Promise<void> {
    const ok = await this.confirm.confirm('¿Quitar esta tarjeta?');
    if (!ok) return;
    const [fuera] = this.landing.secciones[iSec].tarjetas.splice(iTar, 1);
    if (fuera?.imagen) this.landingService.eliminarImagen(fuera.imagen).subscribe({ error: () => {} });
    this.refrescar();
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
        this.marcarGuardado();
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
