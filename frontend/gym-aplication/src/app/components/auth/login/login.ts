import { Component, AfterViewInit, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { AuthService } from '../../../services/auth';
import { ToastService } from '../../../services/toast.service';
import { GymService, Gym } from '../../../services/gym.service';
import { TenantService } from '../../../services/tenant.service';
import { ThemeService } from '../../../services/theme.service';
import { StorageService } from '../../../services/storage.service';
import { UserStateService } from '../../../services/user-state.service';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { GenericOAuth2 } from '@capacitor-community/generic-oauth2';

const GOOGLE_CLIENT_ID = '976541861094-pcm89afbvhdi6fttf7si2cc7gbtuf2pn.apps.googleusercontent.com';

// ID del cliente OAuth de tipo "Android" (Google Cloud → Credenciales → "google android").
// Se usa para el login de Google por navegador (Custom Tabs), que funciona en
// teléfonos sin servicios de Google (Huawei).
const GOOGLE_ANDROID_CLIENT_ID = '976541861094-rb07727og04jbtkrb3o07og0pnbjfbtr.apps.googleusercontent.com';
// Redirect por esquema invertido del client ID de Android (lo exige Google para apps).
const GOOGLE_ANDROID_REDIRECT =
  'com.googleusercontent.apps.' + GOOGLE_ANDROID_CLIENT_ID.replace('.apps.googleusercontent.com', '') + ':/';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit, AfterViewInit {
  usuario = { email: '', password: '' };
  cargando = false;
  verPass = false;
  procesandoGoogle = false;
  gym: Gym | null = null;
  /** Cuando el mismo correo y contraseña existen en varios gimnasios. */
  gimnasiosMultiples: any[] | null = null;
  /** Token de Google a la espera de que el usuario elija gimnasio. */
  private googlePendiente: { tipo: 'credential' | 'access_token'; valor: string } | null = null;
  readonly esNativo = Capacitor.isNativePlatform();
  /** Enlace de primer ingreso reusado con esa misma sesión todavía viva. */
  private gsiCargando: Promise<void> | null = null;

  constructor(
    private ruta: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private toast: ToastService,
    private gymService: GymService,
    private themeService: ThemeService,
    private tenant: TenantService,
    private ngZone: NgZone,
    private storageService: StorageService,
    private userStateService: UserStateService
  ) {}

  /** En el subdominio (o la página pública) de un gimnasio, la URL ya lo fija. */
  gymFijado = false;

  ngOnInit() {
    // El login es universal: si hay un gimnasio en memoria (vino de su página
    // pública) se muestra su logo, pero no hace falta ninguno para entrar.
    this.gym = this.gymService.getGym();
    this.gymFijado = this.tenant.esSubdominio;

    // Correo temporal por primer ingreso (enviarPasswordTemporal en el
    // backend): precarga el campo para que solo falte pegar la contraseña.
    const email = this.ruta.snapshot.queryParamMap.get('email');
    if (email) {
      this.usuario.email = email;
      // El enlace suele abrirse con otra sesión viva: la de quien dio el
      // alta, en el mismo navegador. Se cierra sin preguntar para dejar el
      // formulario limpio — el enlace lleva al login, no al panel de quien
      // ya estaba dentro (noAuthGuard deja pasar el ?email= a propósito).
      if (this.storageService.getToken() && !this.storageService.isTokenExpired()) {
        this.authService.logout();
      }
    }
  }

  async ngAfterViewInit() {
    // En el APK se inicializa el login nativo de Google una sola vez.
    if (this.esNativo) {
      try {
        await SocialLogin.initialize({ google: { webClientId: GOOGLE_CLIENT_ID } });
      } catch (e) {
        console.warn('No se pudo inicializar Google nativo:', e);
      }
      return;
    }
    // En navegador se precarga GSI para que el botón responda al primer clic.
    this.cargarGsi().catch(() => {});
  }

  // Google Identity Services solo existe en la web. En el APK el origen es
  // `https://localhost`, que Google rechaza con 403, y además allí el login va
  // por el plugin nativo — por eso el script se inyecta aquí y no en index.html.
  private cargarGsi(): Promise<void> {
    if (this.gsiCargando) return this.gsiCargando;

    this.gsiCargando = new Promise<void>((resolve, reject) => {
      if ((window as any).google?.accounts?.oauth2) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => {
        // Permitir reintentar en el siguiente clic.
        this.gsiCargando = null;
        script.remove();
        reject(new Error('No se pudo cargar Google Identity Services'));
      };
      document.head.appendChild(script);
    });

    return this.gsiCargando;
  }

  clickGoogleBtn() {
    if (this.esNativo) {
      this.loginGoogleNativo();
    } else {
      this.loginGoogleWeb();
    }
  }

  // --- APK: Google Sign-In nativo (devuelve idToken) ---
  private async loginGoogleNativo() {
    this.procesandoGoogle = true;
    try {
      // Sin `scopes`: el flujo básico de Credential Manager devuelve el idToken
      // (con email y perfil), que es lo único que el backend necesita verificar.
      const res: any = await SocialLogin.login({
        provider: 'google',
        options: {}
      });
      const idToken = res?.result?.idToken;
      if (!idToken) {
        this.ngZone.run(() => {
          this.procesandoGoogle = false;
          this.toast.error('No se pudo obtener el token de Google');
        });
        return;
      }
      this.googlePendiente = { tipo: 'credential', valor: idToken };
      this.authService.loginGoogleNativo(idToken).subscribe({
        next: (r: any) => this.guardarSesion(r),
        error: (err) => this.errorGoogle(err)
      });
    } catch (e: any) {
      const msg = (e?.message || e?.code || '').toString().toLowerCase();
      // El puente nativo de Capacitor responde fuera de la zona de Angular: si el
      // estado se toca sin `ngZone.run`, no se dispara la detección de cambios y la
      // pantalla de "Iniciando sesión…" se queda congelada para siempre.
      if (msg.includes('cancel')) {
        // Cancelar el selector no es un error, pero hay fallos de Credential Manager
        // que llegan disfrazados de USER_CANCELLED (p. ej. "[16] Account reauth
        // failed" cuando la SHA-1 de la firma no está registrada en Google Cloud),
        // así que se deja rastro en consola para poder distinguirlos.
        console.warn('Google nativo devolvió cancelación:', e);
        this.ngZone.run(() => { this.procesandoGoogle = false; });
        return;
      }
      // Sin servicios de Google (Huawei) u otro fallo → login por navegador.
      console.warn('Google nativo no disponible, usando navegador:', e);
      this.ngZone.run(() => this.loginGoogleNavegador());
    }
  }

  // --- Huawei / sin GMS: Google por navegador (Custom Tabs) ---
  private async loginGoogleNavegador() {
    this.procesandoGoogle = true;
    try {
      const res: any = await GenericOAuth2.authenticate({
        authorizationBaseUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        accessTokenEndpoint: 'https://oauth2.googleapis.com/token',
        scope: 'openid email profile',
        responseType: 'code',
        pkceEnabled: true,
        android: {
          appId: GOOGLE_ANDROID_CLIENT_ID,
          responseType: 'code',
          redirectUrl: GOOGLE_ANDROID_REDIRECT
        }
      });

      // El access_token puede venir en distintas ubicaciones según el plugin.
      const accessToken =
        res?.access_token_response?.access_token ||
        res?.authorization_response?.access_token ||
        res?.access_token;

      if (!accessToken) {
        this.ngZone.run(() => {
          this.procesandoGoogle = false;
          this.toast.error('No se pudo obtener el acceso de Google');
        });
        return;
      }

      this.googlePendiente = { tipo: 'access_token', valor: accessToken };
      this.authService.loginConGoogle(accessToken).subscribe({
        next: (r: any) => this.guardarSesion(r),
        error: (err) => this.errorGoogle(err)
      });
    } catch (e: any) {
      // Igual que en el login nativo: la respuesta del plugin llega fuera de la
      // zona de Angular, así que sin `ngZone.run` el overlay no desaparecería.
      console.error('Google navegador error:', e);
      const msg = e?.message || e?.code || (typeof e === 'string' ? e : JSON.stringify(e));
      this.ngZone.run(() => {
        this.procesandoGoogle = false;
        this.toast.error('Google: ' + msg);
      });
    }
  }

  // --- Navegador: Google Identity Services (token de acceso) ---
  private async loginGoogleWeb() {
    try {
      await this.cargarGsi();
    } catch {
      this.toast.error('Google no está disponible. Intenta de nuevo.');
      return;
    }

    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      this.toast.error('Google no está disponible. Intenta de nuevo.');
      return;
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      callback: (tokenResponse: any) => {
        if (tokenResponse.access_token) {
          this.ngZone.run(() => this.handleGoogleToken(tokenResponse.access_token));
        } else {
          this.ngZone.run(() => { this.procesandoGoogle = false; });
        }
      },
      error_callback: () => {
        this.ngZone.run(() => { this.procesandoGoogle = false; });
      }
    });
    this.procesandoGoogle = true;
    client.requestAccessToken();
  }

  private handleGoogleToken(accessToken: string) {
    this.googlePendiente = { tipo: 'access_token', valor: accessToken };
    this.authService.loginConGoogle(accessToken).subscribe({
      next: (res: any) => {
        this.guardarSesion(res);
      },
      error: (err) => this.errorGoogle(err)
    });
  }

  // El backend explica el motivo (gimnasio no seleccionado, token inválido…);
  // mostrarlo evita el genérico que no dice nada al usuario.
  private errorGoogle(err: any) {
    this.procesandoGoogle = false;
    this.toast.error(err?.error?.mensaje || 'Error al iniciar sesión con Google');
  }

  iniciarSesion() {
    if (!this.usuario.email || !this.usuario.password || this.cargando) return;
    this.cargando = true;

    // Sin gymId: el correo resuelve la cuenta en cualquier gimnasio. Solo se
    // manda un gym en la segunda llamada, cuando el usuario eligió entre varios.
    const credenciales = { ...this.usuario };

    this.authService.login(credenciales).subscribe({
      next: (res: any) => {
        this.guardarSesion(res);
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        if (err.status === 400 || err.status === 401) {
          this.toast.error('Credenciales incorrectas. Revisa tu email y contraseña.');
        } else {
          this.toast.error('Error del servidor. Inténtalo más tarde.');
        }
      }
    });
  }

  private guardarSesion(res: any) {
    // ¿El correo existe en varios gimnasios? Que elija entre LOS SUYOS.
    if (res?.multiple && Array.isArray(res.gimnasios)) {
      this.cargando = false;
      this.procesandoGoogle = false;
      this.gimnasiosMultiples = res.gimnasios;
      return;
    }

    // 0) Validar la respuesta del servidor antes de tocar la sesión
    if (!res?.usuario?.role || !res?.usuario?._id || !res?.token) {
      this.cargando = false;
      this.procesandoGoogle = false;
      this.toast.error('Respuesta inválida del servidor');
      return;
    }

    // 1) Limpiar sesión anterior preservando cronómetro y preferencias
    this.storageService.clearSessionPreservingData();

    // 2) Escribir la nueva sesión
    const role = res.usuario.role.toLowerCase().trim();
    localStorage.setItem('userId', res.usuario._id);
    this.storageService.setToken(res.token);
    localStorage.setItem('role', role);
    localStorage.setItem('nombre', res.usuario.nombre);

    // 3) El gimnasio de la cuenta viene en la respuesta: marca y módulos al día
    if (res.gym) {
      this.gymService.guardarGym(res.gym);
      this.themeService.aplicar(res.gym);
    }

    // 4) Sincronizar estado reactivo (escribe 'usuario' y notifica al navbar)
    this.userStateService.updateUser(res.usuario);

    // 5) Contraseña temporal sin cambiar: nada de navbar/paneles hasta que la
    // defina — el guard también lo exige, pero evita el parpadeo de entrar
    // un instante al panel normal antes de que la ruta rebote.
    this.storageService.setDebeCambiarPassword(!!res.usuario.debeCambiarPassword);
    if (res.usuario.debeCambiarPassword) {
      this.router.navigate(['/cambiar-password-inicial']);
      return;
    }

    if (role === 'superadmin') this.router.navigate(['/plataforma']);
    else if (role === 'admin') this.router.navigate(['admin/noticias']);
    else if (role === 'entrenador') this.router.navigate(['/entrenador']);
    else if (role === 'empleado') this.router.navigate(['/empleado']);
    else this.router.navigate(['/socio']);
  }

  /** Segunda llamada del login cuando el correo existe en varios gimnasios. */
  elegirGimnasio(g: any) {
    this.gimnasiosMultiples = null;
    if (this.googlePendiente) {
      const pendiente = this.googlePendiente;
      this.googlePendiente = null;
      this.procesandoGoogle = true;
      const llamada = pendiente.tipo === 'credential'
        ? this.authService.loginGoogleNativo(pendiente.valor, g._id)
        : this.authService.loginConGoogle(pendiente.valor, g._id);
      llamada.subscribe({
        next: (r: any) => this.ngZone.run(() => this.guardarSesion(r)),
        error: (err) => this.ngZone.run(() => this.errorGoogle(err))
      });
      return;
    }
    this.cargando = true;
    this.authService.login({ ...this.usuario, gymId: g._id }).subscribe({
      next: (res: any) => { this.guardarSesion(res); this.cargando = false; },
      error: () => { this.cargando = false; this.toast.error('No se pudo iniciar sesión'); }
    });
  }

  cancelarEleccion() {
    this.gimnasiosMultiples = null;
    this.googlePendiente = null;
  }
}
