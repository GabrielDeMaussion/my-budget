/** Frecuencias posibles de un Payment */
export enum PaymentFrequency {
  ONCE = 'ONCE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

/** Mapa de frecuencias a etiquetas en español */
export const PaymentFrequencyLabels: Record<string, string> = {
  [PaymentFrequency.ONCE]: 'Único',
  [PaymentFrequency.DAILY]: 'Diario',
  [PaymentFrequency.WEEKLY]: 'Semanal',
  [PaymentFrequency.BIWEEKLY]: 'Quincenal',
  [PaymentFrequency.MONTHLY]: 'Mensual',
  [PaymentFrequency.YEARLY]: 'Anual',
};

export function getFrequencyLabel(value: string | null): string {
  if (value === null) return 'Único';
  return PaymentFrequencyLabels[value] ?? value;
}
