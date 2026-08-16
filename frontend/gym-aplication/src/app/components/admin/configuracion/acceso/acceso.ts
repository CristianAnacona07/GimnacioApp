import { Component, OnInit, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ConfiguracionService, Dispositivo, HuellaAsociada } from '../../../../services/configuracion.service';
import { AsistenciaService, SocioBuscado } from '../../../../services/asistencia.service';
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
  private asistenciaService = inject(AsistenciaService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

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

  /** Dirección que necesita el conector de la marca para llamar al "portero". */
  readonly urlVerificar = `${environment.apiUrl}/api/dispositivos/verificar`;

  /** La clave de un equipo solo se muestra una vez, justo después de crearlo o regenerarla. */
  claveNueva: { equipo: string; clave: string } | null = null;

  // ── Huellas por equipo ──────────────────────────────────────────────────
  equipoExpandido: string | null = null;
  huellasPorEquipo: Record<string, HuellaAsociada[]> = {};
  cargandoHuellas = false;
  nuevaHuellaId = '';
  private busqueda$ = new Subject<string>();
  busquedaSocio = '';
  buscando = false;
  resultados: SocioBuscado[] = [];
  socioElegido: SocioBuscado | null = null;

  ngOnInit(): void {
    this.cargar();

    this.busqueda$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((q) => {
          if (!q.trim()) return [];
          this.buscando = true;
          this.cdr.markForCheck();
          return this.asistenciaService.buscar(q);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (res: any) => {
          this.resultados = Array.isArray(res) ? res : [];
          this.buscando = false;
          this.cdr.detectChanges();
        },
        error: () => {
          this.buscando = false;
          this.cdr.detectChanges();
        }
      });
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
          const { apiKey, ...equipoSinClave } = equipo;
          this.equipos = [equipoSinClave, ...this.equipos];
          this.guardando = false;
          this.mostrarForm = false;
          this.nombre = this.serie = '';
          if (apiKey) this.claveNueva = { equipo: equipo.nombre, clave: apiKey };
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

  async regenerarClave(equipo: Dispositivo): Promise<void> {
    const ok = await this.confirm.confirm(
      `¿Regenerar la clave de "${equipo.nombre}"? La clave actual dejará de servir de inmediato: hay que actualizarla también en el conector del equipo.`
    );
    if (!ok) return;

    this.config.regenerarClaveDispositivo(equipo._id).subscribe({
      next: (res) => {
        this.claveNueva = { equipo: equipo.nombre, clave: res.apiKey };
        this.toast.success('Clave regenerada');
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('No se pudo regenerar la clave')
    });
  }

  async copiarClave(): Promise<void> {
    if (!this.claveNueva) return;
    try {
      await navigator.clipboard.writeText(this.claveNueva.clave);
      this.toast.success('Clave copiada');
    } catch {
      this.toast.error('No se pudo copiar');
    }
  }

  cerrarClaveNueva(): void {
    this.claveNueva = null;
  }

  // ── Huellas ───────────────────────────────────────────────────────────

  alternarHuellas(equipo: Dispositivo): void {
    if (this.equipoExpandido === equipo._id) {
      this.equipoExpandido = null;
      return;
    }
    this.equipoExpandido = equipo._id;
    this.cancelarNuevaHuella();
    if (!this.huellasPorEquipo[equipo._id]) this.cargarHuellas(equipo);
  }

  cargarHuellas(equipo: Dispositivo): void {
    this.cargandoHuellas = true;
    this.config.huellas(equipo._id).subscribe({
      next: (res) => {
        this.huellasPorEquipo[equipo._id] = res || [];
        this.cargandoHuellas = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoHuellas = false;
        this.toast.error('No se pudieron cargar las huellas');
        this.cdr.detectChanges();
      }
    });
  }

  buscarSocio(valor: string): void {
    this.busquedaSocio = valor;
    this.socioElegido = null;
    this.busqueda$.next(valor);
  }

  elegirSocio(socio: SocioBuscado): void {
    this.socioElegido = socio;
    this.busquedaSocio = socio.nombre;
    this.resultados = [];
  }

  cancelarNuevaHuella(): void {
    this.nuevaHuellaId = '';
    this.busquedaSocio = '';
    this.socioElegido = null;
    this.resultados = [];
  }

  agregarHuella(equipo: Dispositivo): void {
    const huellaId = Number(this.nuevaHuellaId);
    if (!Number.isInteger(huellaId) || huellaId < 0) {
      this.toast.error('El ID de huella debe ser un número entero (el que asigna el propio equipo al enrolar)');
      return;
    }
    if (!this.socioElegido) {
      this.toast.error('Buscá y elegí un socio de la lista');
      return;
    }

    this.config.asociarHuella(equipo._id, { huellaId, usuarioId: this.socioElegido._id }).subscribe({
      next: () => {
        this.toast.success('Huella asociada');
        this.cancelarNuevaHuella();
        this.cargarHuellas(equipo);
      },
      error: (err) => this.toast.error(err?.error?.error || 'No se pudo asociar la huella')
    });
  }

  async quitarHuella(equipo: Dispositivo, huella: HuellaAsociada): Promise<void> {
    const ok = await this.confirm.confirm(`¿Quitar la huella de "${huella.socio.nombre}" de este equipo?`);
    if (!ok) return;

    this.config.desasociarHuella(equipo._id, huella.huellaId).subscribe({
      next: () => {
        this.huellasPorEquipo[equipo._id] = (this.huellasPorEquipo[equipo._id] || []).filter((h) => h._id !== huella._id);
        this.toast.success('Huella desasociada');
        this.cdr.detectChanges();
      },
      error: () => this.toast.error('No se pudo desasociar la huella')
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
        delete this.huellasPorEquipo[equipo._id];
        if (this.equipoExpandido === equipo._id) this.equipoExpandido = null;
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
