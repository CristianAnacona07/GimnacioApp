import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';
import { FeedbackService, Feedback } from '../../services/feedback.service';

@Component({
  selector: 'app-superadmin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './superadmin.html',
  styleUrl: './superadmin.css'
})
export class SuperAdmin implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  gyms: any[] = [];
  cargando = false;
  feedbacks: Feedback[] = [];
  tabActiva: 'gyms' | 'feedback' = 'gyms';
  mostrarForm = false;
  guardando = false;
  editando: any = null; // gym que se está editando

  // Dominio raíz de la plataforma para los subdominios por gimnasio.
  // Ej: slug "sogafit" → sogafit.micro-gimnacios.com (al desplegar en el VPS).
  readonly dominioBase = 'micro-gimnacios.com';

  // Normaliza lo que el usuario escribe como subdominio (minúsculas, sin espacios/acentos).
  sanitizarSlug(valor: string): string {
    return (valor || '')
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
  }

  nuevo = {
    nombre: '', slug: '', slogan: '',
    logo: null as string | null,
    colores: { primario: '#f97316', secundario: '#1d4ed8', fondo: '#eef3ff', navbar: '#0f172a', menu: '#1e293b', dias: '#1d4ed8' } as Record<string, string>,
    modulos: { rutinas: true, progreso: true, medidas: true, pagos: true, noticias: true, cronometro: true } as Record<string, boolean>
  };

  private get headers() {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` };
  }

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private toast: ToastService,
    private confirm: ConfirmService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private feedbackService: FeedbackService
  ) {}

  ngOnInit() {
    this.cargar();
    this.cargarFeedbacks();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarFeedbacks() {
    this.feedbackService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.feedbacks = data; this.cdr.detectChanges(); },
      error: (err) => {
        console.error('Error al cargar feedbacks:', err);
        this.toast.error('Error al cargar feedbacks');
      }
    });
  }

  marcarLeido(fb: Feedback) {
    if (!fb._id || fb.leido) return;
    this.feedbackService.marcarLeido(fb._id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { fb.leido = true; this.cdr.detectChanges(); }
    });
  }

  get feedbacksNoLeidos(): number {
    return this.feedbacks.filter(f => !f.leido).length;
  }

  formatFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  cargar() {
    this.cargando = true;
    this.http.get<any[]>(`${environment.apiUrl}/api/gym`, { headers: this.headers }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.gyms = data; this.cargando = false; this.cdr.detectChanges(); },
      error: () => { this.cargando = false; this.toast.error('Error al cargar gimnasios'); }
    });
  }

  generarSlug() {
    this.nuevo.slug = this.nuevo.nombre
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  }

  procesarImagen(file: File, callback: (base64: string) => void) {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onerror = () => {
      console.error('Error al leer la imagen:', reader.error);
      this.toast.error('Error al leer la imagen');
    };
    reader.onload = (e: any) => {
      const img = new Image();
      img.src = e.target.result;
      img.onerror = () => {
        console.error('Error al cargar la imagen');
        this.toast.error('Error al procesar la imagen');
      };
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 200;
        const scale = MAX / Math.max(img.width, img.height);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL('image/jpeg', 0.85));
        this.cdr.detectChanges();
      };
    };
  }

  onLogoChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.procesarImagen(file, (b64) => this.nuevo.logo = b64);
  }

  onLogoEditChange(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.procesarImagen(file, (b64) => this.editando.logo = b64);
  }

  abrirEditar(gym: any) {
    this.editando = {
      ...gym,
      colores: { ...gym.colores } as Record<string, string>,
      modulos: { ...gym.modulos } as Record<string, boolean>
    };
    this.mostrarForm = false;
  }

  cerrarEditar() {
    this.editando = null;
  }

  guardarEdicion() {
    if (!this.editando || this.guardando) return;
    this.guardando = true;
    this.http.put(`${environment.apiUrl}/api/gym/${this.editando._id}/configuracion`, {
      nombre: this.editando.nombre,
      slug: this.editando.slug,
      logo: this.editando.logo,
      slogan: this.editando.slogan,
      colores: this.editando.colores,
      modulos: this.editando.modulos
    }, { headers: this.headers }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success('Gimnasio actualizado');
        this.guardando = false;
        this.editando = null;
        this.cargar();
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Error al guardar');
        this.guardando = false;
      }
    });
  }

  async crear() {
    if (!this.nuevo.nombre || !this.nuevo.slug || this.guardando) return;
    this.guardando = true;
    this.http.post(`${environment.apiUrl}/api/gym/crear`, this.nuevo, { headers: this.headers }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.toast.success('Gimnasio creado');
        this.mostrarForm = false;
        this.nuevo = { nombre: '', slug: '', slogan: '', logo: null,
          colores: { primario: '#f97316', secundario: '#1d4ed8', fondo: '#eef3ff', navbar: '#0f172a', menu: '#1e293b', dias: '#1d4ed8' } as Record<string, string>,
          modulos: { rutinas: true, progreso: true, medidas: true, pagos: true, noticias: true, cronometro: true } as Record<string, boolean>
        };
        this.guardando = false;
        this.cargar();
      },
      error: (err) => {
        this.toast.error(err.error?.error || 'Error al crear');
        this.guardando = false;
      }
    });
  }

  async toggleActivo(gym: any) {
    const accion = gym.activo ? 'desactivar' : 'activar';
    const ok = await this.confirm.confirm(`¿${accion} "${gym.nombre}"?`);
    if (!ok) return;
    this.http.patch(`${environment.apiUrl}/api/gym/${gym._id}/estado`,
      { activo: !gym.activo }, { headers: this.headers }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success(`Gimnasio ${accion}do`); this.cargar(); },
      error: () => this.toast.error('Error al cambiar estado')
    });
  }

  async eliminar(gym: any) {
    const ok = await this.confirm.confirm(`¿Eliminar permanentemente "${gym.nombre}"? Esta acción no se puede deshacer.`);
    if (!ok) return;
    this.http.delete(`${environment.apiUrl}/api/gym/${gym._id}`, { headers: this.headers }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.toast.success('Gimnasio eliminado'); this.cargar(); },
      error: () => this.toast.error('Error al eliminar')
    });
  }

  cerrarSesion() {
    this.auth.logout();
    this.router.navigate(['/sa']);
  }
}
