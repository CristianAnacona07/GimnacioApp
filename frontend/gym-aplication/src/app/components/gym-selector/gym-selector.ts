import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { GymService, Gym } from '../../services/gym.service';
import { ThemeService } from '../../services/theme.service';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-gym-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './gym-selector.html',
  styleUrl: './gym-selector.css'
})
export class GymSelector implements OnInit, OnDestroy {
  query = '';
  gyms: Gym[] = [];
  cargando = false;
  buscado = false;

  private query$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private gymService: GymService,
    private themeService: ThemeService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private storageService: StorageService
  ) {}

  ngOnInit() {
    // Si ya tiene gym y una sesión válida (token no expirado), ir al dashboard.
    const token = this.storageService.getToken();
    const gym = this.gymService.getGym();

    if (token && gym && !this.storageService.isTokenExpired()) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const role = payload.role?.toLowerCase().trim();
        if (role === 'superadmin') { this.router.navigate(['/plataforma']); return; }
        if (role === 'admin') { this.router.navigate(['/admin']); return; }
        if (role === 'socio') { this.router.navigate(['/socio']); return; }
      } catch { /* token ilegible → mostrar selector */ }
    }

    // Carga inicial — muestra todos los gyms disponibles
    this.buscarGyms('');

    // Debounce de 350ms al escribir
    this.query$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(q => this.buscarGyms(q));
  }

  onInput() {
    this.query$.next(this.query);
  }

  buscarGyms(q: string) {
    this.cargando = true;
    this.gymService.buscar(q).subscribe({
      next: (data) => {
        this.gyms = data;
        this.cargando = false;
        this.buscado = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargando = false;
        this.buscado = true;
        this.cdr.detectChanges();
      }
    });
  }

  seleccionar(gym: Gym) {
    this.gymService.guardarGym(gym);
    this.themeService.aplicar(gym);
    // Limpia sesión anterior para forzar nuevo login en el gym seleccionado
    // Preserva cronómetro y preferencias
    this.storageService.clearSessionPreservingData();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
