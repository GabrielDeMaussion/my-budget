/** Estados posibles de un Payment (registro de pago recurrente / plantilla) */
export enum PaymentState {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

/** Mapa de estados de Payment a etiquetas en español */
export const PaymentStateLabels: Record<string, string> = {
  [PaymentState.ACTIVE]: 'Activo',
  [PaymentState.PAUSED]: 'Pausado',
  [PaymentState.CANCELLED]: 'Cancelado',
  [PaymentState.COMPLETED]: 'Completado',
};

/** Color del badge según estado del plan */
export const PaymentStateColors: Record<string, string> = {
  [PaymentState.ACTIVE]: 'success',
  [PaymentState.PAUSED]: 'warning',
  [PaymentState.CANCELLED]: 'error',
  [PaymentState.COMPLETED]: 'info',
};

export function getPaymentStateLabel(value: string): string {
  return PaymentStateLabels[value] ?? value;
}

export function getPaymentStateColor(value: string): string {
  return PaymentStateColors[value] ?? 'ghost';
}
