import { Component, inject } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule, AsyncPipe],
  templateUrl: './notification.html',
  styleUrl: './notification.css'
})
export class Notification {
  toastService = inject(ToastService);
  confirmService = inject(ConfirmService);

  toasts$ = this.toastService.toasts$;
  confirmState$ = this.confirmService.state$;

  responder(value: boolean) {
    this.confirmService.respond(value);
  }
}
