import { Component, AfterViewInit, NgZone, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { AuthService } from '../../../services/auth';
import { ToastService } from '../../../services/toast.service';
import { GymService, Gym } from '../../../services/gym.service';
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
  readonly esNativo = Capacitor.isNativePlatform();

  constructor(
    private router: Router,
    private authService: AuthService,
    private toast: ToastService,
    private gymService: GymService,
    private ngZone: NgZone,
    private storageService: StorageService,
    private userStateService: UserStateService
  ) {}

  ngOnInit() {
    this.gym = this.gymService.getGym();
    if (!this.gym) {
      this.router.navigate(['/gimnasios']);
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
    }
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
        this.procesandoGoogle = false;
        this.toast.error('No se pudo obtener el token de Google');
        return;
      }
      const gymId = this.gym?._id || null;
      this.authService.loginGoogleNativo(idToken, gymId).subscribe({
        next: (r: any) => this.guardarSesion(r),
        error: () => {
          this.procesandoGoogle = false;
          this.toast.error('Error al iniciar sesión con Google');
        }
      });
    } catch (e: any) {
      const msg = (e?.message || e?.code || '').toString().toLowerCase();
      // Si el usuario canceló el selector, no hacer nada (ni error ni fallback).
      if (msg.includes('cancel')) {
        this.procesandoGoogle = false;
        return;
      }
      // Sin servicios de Google (Huawei) u otro fallo → login por navegador.
      console.warn('Google nativo no disponible, usando navegador:', e);
      this.loginGoogleNavegador();
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
        this.procesandoGoogle = false;
        this.toast.error('No se pudo obtener el acceso de Google');
        return;
      }

      const gymId = this.gym?._id || null;
      this.authService.loginConGoogle(accessToken, gymId).subscribe({
        next: (r: any) => this.guardarSesion(r),
        error: () => {
          this.procesandoGoogle = false;
          this.toast.error('Error al iniciar sesión con Google');
        }
      });
    } catch (e: any) {
      this.procesandoGoogle = false;
      const msg = e?.message || e?.code || (typeof e === 'string' ? e : JSON.stringify(e));
      this.toast.error('Google: ' + msg);
      console.error('Google navegador error:', e);
    }
  }

  // --- Navegador: Google Identity Services (token de acceso) ---
  private loginGoogleWeb() {
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
    const gymId = this.gym?._id || null;
    this.authService.loginConGoogle(accessToken, gymId).subscribe({
      next: (res: any) => {
        this.guardarSesion(res);
      },
      error: () => {
        this.procesandoGoogle = false;
        this.toast.error('Error al iniciar sesión con Google');
      }
    });
  }

  iniciarSesion() {
    if (!this.usuario.email || !this.usuario.password || this.cargando) return;
    this.cargando = true;

    const credenciales = {
      ...this.usuario,
      gymId: this.gym?._id || null
    };

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

    // 3) Sincronizar estado reactivo (escribe 'usuario' y notifica al navbar)
    this.userStateService.updateUser(res.usuario);

    if (role === 'superadmin') this.router.navigate(['/plataforma']);
    else if (role === 'admin') this.router.navigate(['admin/noticias']);
    else this.router.navigate(['/socio']);
  }

  cambiarGym() {
    this.gymService.limpiarGym();
    this.router.navigate(['/gimnasios']);
  }
}
