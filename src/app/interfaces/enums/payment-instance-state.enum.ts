/** Estados posibles de una instancia de pago */
export enum PaymentInstanceState {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  OVERDUE = 'OVERDUE',
}

/** Mapa de estados de instancia a etiquetas en español */
export const PaymentInstanceStateLabels: Record<string, string> = {
  [PaymentInstanceState.PENDING]: 'Pendiente',
  [PaymentInstanceState.PAID]: 'Pagado',
  [PaymentInstanceState.CANCELLED]: 'Cancelado',
  [PaymentInstanceState.OVERDUE]: 'Vencido',
};

/** Color del badge según estado de instancia */
export const PaymentInstanceStateColors: Record<string, string> = {
  [PaymentInstanceState.PENDING]: 'warning',
  [PaymentInstanceState.PAID]: 'success',
  [PaymentInstanceState.CANCELLED]: 'error',
  [PaymentInstanceState.OVERDUE]: 'error',
};

export function getInstanceStateLabel(value: string): string {
  return PaymentInstanceStateLabels[value] ?? value;
}

export function getInstanceStateColor(value: string): string {
  return PaymentInstanceStateColors[value] ?? 'ghost';
}
