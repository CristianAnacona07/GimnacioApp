import { Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class UpdateService {
  constructor(private swUpdate: SwUpdate) {
    if (!swUpdate.isEnabled) return;

    swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => {
        this.mostrarBannerActualizacion();
      });

    // Verificar actualizaciones cada 5 minutos
    setInterval(() => swUpdate.checkForUpdate(), 5 * 60 * 1000);
  }

  private mostrarBannerActualizacion() {
    document.getElementById('update-banner')?.remove();
    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.innerHTML = `
      <div style="
        position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
        background:#1d4ed8; color:white; padding:14px 20px;
        border-radius:14px; box-shadow:0 8px 24px rgba(29,78,216,0.4);
        display:flex; align-items:center; gap:12px; z-index:99999;
        font-family:sans-serif; font-size:14px; font-weight:600;
        white-space:nowrap; animation:slideUpBanner 0.3s ease;
      ">
        <span>🚀 Nueva versión disponible</span>
        <button onclick="window.location.reload()" style="
          background:white; color:#1d4ed8; border:none; padding:6px 14px;
          border-radius:8px; font-weight:700; cursor:pointer; font-size:13px;
        ">Actualizar</button>
      </div>
      <style>
        @keyframes slideUpBanner {
          from { opacity:0; transform:translateX(-50%) translateY(20px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
      </style>
    `;
    document.body.appendChild(banner);
  }
}
