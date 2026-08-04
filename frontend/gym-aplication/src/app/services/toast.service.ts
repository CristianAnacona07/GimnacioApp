import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  private toastsSubject = new BehaviorSubject<Toast[]>([]);
  toasts$ = this.toastsSubject.asObservable();

  success(message: string, duration = 3500) {
    this.add(message, 'success', duration);
  }

  error(message: string, duration = 4000) {
    this.add(message, 'error', duration);
  }

  info(message: string, duration = 3500) {
    this.add(message, 'info', duration);
  }

  private add(message: string, type: Toast['type'], duration: number) {
    const id = ++this.counter;
    this.toastsSubject.next([...this.toastsSubject.value, { id, message, type }]);
    setTimeout(() => this.remove(id), duration);
  }

  remove(id: number) {
    this.toastsSubject.next(this.toastsSubject.value.filter(t => t.id !== id));
  }
}
