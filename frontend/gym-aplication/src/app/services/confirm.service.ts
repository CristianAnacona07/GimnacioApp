import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ConfirmState {
  visible: boolean;
  message: string;
  resolve?: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private stateSubject = new BehaviorSubject<ConfirmState>({ visible: false, message: '' });
  state$ = this.stateSubject.asObservable();

  confirm(message: string): Promise<boolean> {
    return new Promise(resolve => {
      this.stateSubject.next({ visible: true, message, resolve });
    });
  }

  respond(value: boolean) {
    const state = this.stateSubject.value;
    state.resolve?.(value);
    this.stateSubject.next({ visible: false, message: '' });
  }
}
