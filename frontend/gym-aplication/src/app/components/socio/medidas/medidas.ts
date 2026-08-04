import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MedidasService, Medida } from '../../../services/medidas.service';
import { UserStateService } from '../../../services/user-state.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';

const CAMPOS = [
  { key: 'peso',    label: 'Peso',    unidad: 'kg', emoji: '⚖️' },
  { key: 'cintura', label: 'Cintura', unidad: 'cm', emoji: '📏' },
  { key: 'cadera',  label: 'Cadera',  unidad: 'cm', emoji: '📐' },
  { key: 'pecho',   label: 'Pecho',   unidad: 'cm', emoji: '💪' },
  { key: 'brazo',   label: 'Brazo',   unidad: 'cm', emoji: '🦾' },
  { key: 'muslo',   label: 'Muslo',   unidad: 'cm', emoji: '🦵' },
] as const;

type CampoKey = typeof CAMPOS[number]['key'];

@Component({
  selector: 'app-medidas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './medidas.html',
  styleUrl: './medidas.css'
})
export class Medidas implements OnInit {
  usuarioId = '';
  historial: Medida[] = [];
  guardando = false;
  mostrarForm = false;

  readonly campos = CAMPOS;

  nueva: Partial<Record<CampoKey, number | null>> = {};
  editando: Medida | null = null;
  editForm: Partial<Record<CampoKey, number | null>> = {};

  constructor(
    private medidasService: MedidasService,
    private userState: UserStateService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    const user = this.userState.getCurrentUser();
    if (user?._id) {
      this.usuarioId = user._id;
      this.cargar();
    }
  }

  cargar() {
    this.medidasService.getHistorial(this.usuarioId).subscribe({
      next: (data) => { this.historial = data; this.cdr.detectChanges(); },
      error: () => this.toast.error('Error al cargar medidas')
    });
  }

  get ultima(): Medida | null {
    return this.historial.length ? this.historial[this.historial.length - 1] : null;
  }

  get historialReverso(): Medida[] {
    return [...this.historial].reverse();
  }

  diferencia(campo: CampoKey): string {
    if (this.historial.length < 2) return '';
    const ant = this.historial[this.historial.length - 2][campo];
    const act = this.historial[this.historial.length - 1][campo];
    if (ant == null || act == null) return '';
    const diff = (act as number) - (ant as number);
    return diff > 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
  }

  diferenciaPositiva(campo: CampoKey): boolean {
    if (this.historial.length < 2) return false;
    const ant = this.historial[this.historial.length - 2][campo];
    const act = this.historial[this.historial.length - 1][campo];
    if (ant == null || act == null) return false;
    return (act as number) > (ant as number);
  }

  async guardar() {
    const hayDato = this.campos.some(c => this.nueva[c.key] != null);
    if (!hayDato) { this.toast.error('Ingresá al menos una medida'); return; }

    this.guardando = true;
    this.medidasService.guardar({ usuarioId: this.usuarioId, ...this.nueva }).subscribe({
      next: () => {
        this.toast.success('Medidas guardadas');
        this.nueva = {};
        this.mostrarForm = false;
        this.guardando = false;
        this.cargar();
      },
      error: () => { this.toast.error('Error al guardar'); this.guardando = false; }
    });
  }

  abrirEditar(m: Medida) {
    this.editando = m;
    this.editForm = {
      peso: m.peso ?? null, cintura: m.cintura ?? null,
      cadera: m.cadera ?? null, pecho: m.pecho ?? null,
      brazo: m.brazo ?? null, muslo: m.muslo ?? null,
    };
    this.mostrarForm = false;
  }

  cancelarEditar() { this.editando = null; this.editForm = {}; }

  guardarEdicion() {
    if (!this.editando?._id) return;
    this.guardando = true;
    this.medidasService.actualizar(this.editando._id, this.editForm).subscribe({
      next: () => {
        this.toast.success('Medidas actualizadas');
        this.editando = null;
        this.editForm = {};
        this.guardando = false;
        this.cargar();
      },
      error: () => { this.toast.error('Error al actualizar'); this.guardando = false; }
    });
  }

  async eliminar(id: string) {
    const ok = await this.confirm.confirm('¿Eliminar este registro de medidas?');
    if (!ok) return;
    this.medidasService.eliminar(id).subscribe({
      next: () => { this.toast.success('Registro eliminado'); this.cargar(); },
      error: () => this.toast.error('Error al eliminar')
    });
  }

  formatFecha(fechaStr: string): string {
    const [y, m, d] = fechaStr.split('T')[0].split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es', { day: '2-digit', month: 'short', year: '2-digit' });
  }
}
