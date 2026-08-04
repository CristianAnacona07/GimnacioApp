import { Injectable } from '@angular/core';
import { GymService, Gym } from './gym.service';

const DEFAULTS = {
  primario:   '#f97316',
  secundario: '#1d4ed8',
  fondo:      '#eef3ff',
  navbar:     '#0f172a',
  menu:       '#1e293b',
  dias:       '#1d4ed8'
};

@Injectable({ providedIn: 'root' })
export class ThemeService {

  constructor(private gymService: GymService) {}

  aplicar(gym?: Gym | null) {
    const colores = gym?.colores || this.gymService.getGym()?.colores || DEFAULTS;
    const root = document.documentElement;

    // Esquema simplificado: el color PRINCIPAL (navbar) rige también los botones
    // (primario), el menú lateral y los días de rutina — así toda la app se ve
    // coherente con un solo color, sin depender de valores viejos guardados.
    const principal = colores.navbar || DEFAULTS.navbar;

    root.style.setProperty('--color-navbar',     principal);
    root.style.setProperty('--color-primario',   principal);
    root.style.setProperty('--color-menu',       principal);
    root.style.setProperty('--color-dias',       principal);
    root.style.setProperty('--color-secundario', colores.secundario || DEFAULTS.secundario);
    root.style.setProperty('--color-fondo',      colores.fondo      || DEFAULTS.fondo);
  }

  resetear() {
    const root = document.documentElement;
    root.style.setProperty('--color-primario',   DEFAULTS.primario);
    root.style.setProperty('--color-secundario', DEFAULTS.secundario);
    root.style.setProperty('--color-fondo',      DEFAULTS.fondo);
    root.style.setProperty('--color-navbar',     DEFAULTS.navbar);
    root.style.setProperty('--color-menu',       DEFAULTS.menu);
    root.style.setProperty('--color-dias',       DEFAULTS.dias);
  }
}
