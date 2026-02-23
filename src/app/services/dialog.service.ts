import { computed, inject, Injectable, signal, TemplateRef } from '@angular/core';
import { Observable, Subject, take } from 'rxjs';

// --------------- Types --------------- //
export type DialogType = 'alert' | 'confirm' | 'custom';
export type DialogSeverity = 'info' | 'warning' | 'error' | 'success';

/** Configuración de un diálogo */
export interface DialogConfig {
  type: DialogType;
  title: string;
  message?: string;
  severity?: DialogSeverity;
  confirmText?: string;
  cancelText?: string;
  templateRef?: TemplateRef<any>;
  context?: any;
  /** Si true, el modal se renderiza más ancho (ideal para formularios) */
  wide?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class DialogService {
  // --------------- State --------------- //
  private _config = signal<DialogConfig | null>(null);
  private _resultSubject = new Subject<any>();

  // --------------- Computeds --------------- //
  config = this._config.asReadonly();
  isOpen = computed(() => this._config() !== null);

  // --------------- Methods --------------- //
  /**
   * Abre un diálogo con la configuración dada.
   * Retorna un Observable que emite el resultado al cerrar.
   */
  open(config: DialogConfig): Observable<any> {
    this._config.set(config);
    return this._resultSubject.asObservable().pipe(take(1));
  }

  /** Cierra el diálogo actual y emite el resultado */
  close(result?: any): void {
    this._config.set(null);
    this._resultSubject.next(result);
  }

  // --------------- Shortcuts --------------- //
  /** Muestra una alerta informativa */
  alert(title: string, message: string, severity: DialogSeverity = 'info'): Observable<void> {
    return this.open({
      type: 'alert',
      title,
      message,
      severity,
      confirmText: 'Aceptar',
    });
  }

  /** Muestra un diálogo de confirmación */
  confirm(title: string, message: string, severity: DialogSeverity = 'warning'): Observable<boolean> {
    return this.open({
      type: 'confirm',
      title,
      message,
      severity,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
    });
  }

  /** Abre un diálogo con contenido personalizado (template) */
  custom(title: string, templateRef: TemplateRef<any>, context?: any): Observable<any> {
    return this.open({
      type: 'custom',
      title,
      templateRef,
      context,
      confirmText: 'Aceptar',
      cancelText: 'Cancelar',
    });
  }
}
