import { Injectable, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth';

/**
 * Servicio que monitorea la expiración del token JWT
 * Muestra advertencias y renueva automáticamente cuando es posible
 */
@Injectable({ providedIn: 'root' })
export class TokenMonitorService implements OnDestroy {
  private checkInterval: any = null;
  private warningShown = false;
  private tokenRenewed = false;
  private readonly CHECK_INTERVAL_MS = 60000; // Revisar cada minuto
  // El token vive 8h: renovar cuando quedan <2h y avisar cuando quedan <30min.
  private readonly RENEWAL_THRESHOLD_MS = 2 * 60 * 60 * 1000; // Renovar con 2 horas

  private authService = inject(AuthService);

  constructor(
    private storageService: StorageService,
    private toastService: ToastService,
    private router: Router
  ) {}

  /**
   * Inicia el monitoreo del token
   */
  startMonitoring(): void {
    if (this.checkInterval) return;

    // Verificar inmediatamente
    this.checkTokenExpiration();

    // Luego revisar cada minuto
    this.checkInterval = setInterval(() => {
      this.checkTokenExpiration();
    }, this.CHECK_INTERVAL_MS);
  }

  /**
   * Detiene el monitoreo
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.warningShown = false;
    this.tokenRenewed = false;
  }

  /**
   * Verifica el estado del token
   */
  private checkTokenExpiration(): void {
    const token = this.storageService.getToken();
    if (!token) {
      this.stopMonitoring();
      return;
    }

    // Si el token ya expiró, cerrar sesión
    if (this.storageService.isTokenExpired()) {
      this.handleExpiredToken();
      return;
    }

    const remaining = this.storageService.getTokenTimeRemaining();

    // Si quedan menos de 2h, intentar renovar automáticamente (solo una vez)
    if (remaining < this.RENEWAL_THRESHOLD_MS && remaining > 0 && !this.tokenRenewed) {
      this.renewTokenAutomatically();
    }

    // Si el token expira pronto (< 30min), mostrar advertencia (solo una vez)
    if (this.storageService.isTokenExpiringSoon() && !this.warningShown) {
      this.showExpirationWarning();
    }
  }

  /**
   * Renueva el token automáticamente cuando quedan menos de 7 días
   */
  private renewTokenAutomatically(): void {
    this.tokenRenewed = true;

    this.authService.refreshToken().subscribe({
      next: () => {
        this.toastService.success('Tu sesión ha sido renovada automáticamente', 3000);
        // Resetear flags: el token nuevo tiene ~8h, asi que la condicion de
        // renovacion (<2h) no se re-disparara de inmediato. Permite futuras
        // renovaciones y advertencias en sesiones largas.
        this.warningShown = false;
        this.tokenRenewed = false;
      },
      error: () => {
        // Si falla la renovación, mostrar advertencia manual
        this.tokenRenewed = false;
        this.showExpirationWarning();
      }
    });
  }

  /**
   * Maneja un token expirado
   */
  private handleExpiredToken(): void {
    this.toastService.error('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
    this.storageService.clearSessionPreservingData();
    this.stopMonitoring();

    // Redirigir al login después de un breve delay
    setTimeout(() => {
      this.router.navigate(['/login']);
    }, 1500);
  }

  /**
   * Muestra advertencia de expiración próxima
   */
  private showExpirationWarning(): void {
    const remaining = this.storageService.getTokenTimeRemaining();
    const minutos = Math.max(1, Math.round(remaining / (1000 * 60)));

    this.toastService.info(
      `Tu sesión expirará en ~${minutos} minuto(s). Guarda tu progreso.`,
      5000
    );

    this.warningShown = true;
  }

  ngOnDestroy(): void {
    this.stopMonitoring();
  }
}
