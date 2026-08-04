import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';
import { GymService } from '../../../services/gym.service';

// Playlist por defecto (Beast Mode / entrenamiento). El gym puede sobreescribirla
// si en el futuro se añade el campo `spotifyPlaylist` a su configuración.
const DEFAULT_PLAYLIST = '37i9dQZF1DX76Wlfdnj7AP';

@Component({
  selector: 'app-spotify-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spotify-player.html',
  styleUrl: './spotify-player.css'
})
export class SpotifyPlayer {
  // Arranca colapsado (solo el botón flotante). Al abrir por primera vez se monta
  // el iframe y NUNCA se desmonta: al minimizar solo se oculta, así la música
  // sigue sonando aunque la tarjeta no esté a la vista.
  minimizado = true;
  iframeMontado = false;
  readonly playlistId: string;
  readonly embedUrl: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer, private gymService: GymService) {
    const gym: any = this.gymService.getGym();
    this.playlistId = gym?.spotifyPlaylist || DEFAULT_PLAYLIST;
    // El iframe requiere una URL "confiable" para Angular.
    this.embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://open.spotify.com/embed/playlist/${this.playlistId}?utm_source=generator&theme=0`
    );
  }

  toggle() {
    if (this.minimizado) {
      this.iframeMontado = true;   // monta el reproductor la primera vez
      this.minimizado = false;     // muestra la tarjeta
    } else {
      this.minimizado = true;      // minimiza: la tarjeta se oculta, el iframe sigue sonando
    }
  }

  // Abre la app nativa de Spotify (deep link) y, si no está instalada,
  // el enlace web. En navegador, abre la pestaña web.
  async abrirEnSpotify() {
    const appUrl = `spotify:playlist:${this.playlistId}`;
    const webUrl = `https://open.spotify.com/playlist/${this.playlistId}`;
    if (Capacitor.isNativePlatform()) {
      try {
        await AppLauncher.openUrl({ url: appUrl });
      } catch {
        try { await AppLauncher.openUrl({ url: webUrl }); } catch { /* sin handler */ }
      }
    } else {
      window.open(webUrl, '_blank');
    }
  }
}
