import { Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DialogService } from '../../services/dialog.service';

@Component({
  selector: 'app-dialog',
  imports: [NgTemplateOutlet],
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.css'],
})
export class DialogComponent {
  // --------------- Injects --------------- //
  readonly dialogService = inject(DialogService);

  // --------------- Computeds --------------- //
  severityIcon = computed(() => {
    switch (this.dialogService.config()?.severity) {
      case 'info':
        return 'bi-info-circle-fill';
      case 'warning':
        return 'bi-exclamation-triangle-fill';
      case 'error':
        return 'bi-x-circle-fill';
      case 'success':
        return 'bi-check-circle-fill';
      default:
        return '';
    }
  });

  severityColor = computed(() => {
    switch (this.dialogService.config()?.severity) {
      case 'info':
        return 'text-info';
      case 'warning':
        return 'text-warning';
      case 'error':
        return 'text-error';
      case 'success':
        return 'text-success';
      default:
        return 'text-primary';
    }
  });

  // --------------- Methods --------------- //
  onConfirm(): void {
    const type = this.dialogService.config()?.type;
    if (type === 'confirm') {
      this.dialogService.close(true);
    } else {
      this.dialogService.close();
    }
  }

  onCancel(): void {
    const type = this.dialogService.config()?.type;
    if (type === 'confirm') {
      this.dialogService.close(false);
    } else {
      this.dialogService.close(undefined);
    }
  }
}
