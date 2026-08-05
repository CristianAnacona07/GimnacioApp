import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/** Botón a medida del diálogo (para preguntas que no son un sí/no). */
export interface ConfirmOpcion {
  texto: string;
  valor: string;
  /** 'primario' pinta el botón destacado; el resto salen neutros. */
  estilo?: 'primario' | 'neutro';
}

export interface ConfirmState {
  visible: boolean;
  message: string;
  /** Si viene, se pintan estos botones en vez de Cancelar/Confirmar. */
  opciones?: ConfirmOpcion[];
  resolve?: (value: any) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private stateSubject = new BehaviorSubject<ConfirmState>({ visible: false, message: '' });
  state$ = this.stateSubject.asObservable();

  /** Diálogo sí/no de toda la vida. */
  confirm(message: string): Promise<boolean> {
    return new Promise(resolve => {
      this.stateSubject.next({ visible: true, message, resolve });
    });
  }

  /**
   * Diálogo con varias salidas. Devuelve el `valor` del botón pulsado, o null si
   * se cierra sin elegir; quien lo llama debe tratar null como "no hacer nada".
   */
  elegir(message: string, opciones: ConfirmOpcion[]): Promise<string | null> {
    return new Promise(resolve => {
      this.stateSubject.next({ visible: true, message, opciones, resolve });
    });
  }

  respond(value: any) {
    const state = this.stateSubject.value;
    state.resolve?.(value);
    this.stateSubject.next({ visible: false, message: '' });
  }
}
