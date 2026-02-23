import { PaymentFrequency } from '../interfaces/enums/payment-frequency.enum';

// ─────────────────── Public API ───────────────────

/**
 * Genera TODAS las fechas de instancia para un pago recurrente finito.
 * Se crean tantas fechas como cuotas (installments).
 */
export function generateFiniteInstanceDates(
  frequency: string,
  startDate: string,
  paymentDay: number | null,
  installments: number
): string[] {
  const dates: string[] = [];
  let current = getFirstInstanceDate(frequency, startDate, paymentDay);

  for (let i = 0; i < installments; i++) {
    dates.push(formatDate(current));
    current = advanceDate(current, frequency, paymentDay);
  }

  return dates;
}

/**
 * Genera fechas de instancia desde startDate hasta upToDate (inclusive)
 * para pagos recurrentes indefinidos.
 */
export function generateIndefiniteInstanceDates(
  frequency: string,
  startDate: string,
  paymentDay: number | null,
  upToDate: string
): string[] {
  const dates: string[] = [];
  const limit = parseDateParts(upToDate);
  if (!limit) return [startDate];

  let current = getFirstInstanceDate(frequency, startDate, paymentDay);

  while (current <= limit) {
    dates.push(formatDate(current));
    current = advanceDate(current, frequency, paymentDay);
  }

  return dates.length > 0 ? dates : [startDate];
}

/** Calcula el monto por cuota para pagos finitos recurrentes */
export function calculateInstallmentAmount(
  totalAmount: number,
  installments: number | null
): number | null {
  if (!installments || installments <= 1) return null;
  return Math.round((totalAmount / installments) * 100) / 100;
}

// ─────────────────── Helpers ───────────────────

/**
 * Determina la primera fecha de instancia según la frecuencia y el día de pago.
 * - MONTHLY: usa paymentDay como día del mes sobre el mes de startDate.
 * - WEEKLY/BIWEEKLY: avanza al primer día de la semana que coincida con paymentDay.
 * - DAILY/YEARLY/other: usa startDate tal cual.
 */
function getFirstInstanceDate(
  frequency: string,
  startDate: string,
  paymentDay: number | null
): Date {
  const start = parseDateParts(startDate);
  if (!start) return new Date();

  switch (frequency) {
    case PaymentFrequency.MONTHLY:
      if (paymentDay) {
        return clampDay(start.getFullYear(), start.getMonth(), paymentDay);
      }
      return start;

    case PaymentFrequency.WEEKLY:
    case PaymentFrequency.BIWEEKLY:
      if (paymentDay) {
        // paymentDay: 1=Lunes … 7=Domingo → JS: 0=Domingo, 1=Lunes …
        const targetJsDay = paymentDay === 7 ? 0 : paymentDay;
        const currentJsDay = start.getDay();
        const diff = (targetJsDay - currentJsDay + 7) % 7;
        const result = new Date(start.getFullYear(), start.getMonth(), start.getDate() + diff);
        return result;
      }
      return start;

    default:
      return start;
  }
}

/**
 * Avanza una fecha al siguiente período según la frecuencia.
 * Para MONTHLY usa clampDay para manejar meses con menos días que paymentDay.
 */
function advanceDate(d: Date, frequency: string, paymentDay: number | null): Date {
  switch (frequency) {
    case PaymentFrequency.DAILY:
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    case PaymentFrequency.WEEKLY:
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
    case PaymentFrequency.BIWEEKLY:
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 14);
    case PaymentFrequency.MONTHLY: {
      const nextMonth = d.getMonth() + 1;
      const year = d.getFullYear() + Math.floor(nextMonth / 12);
      const month = nextMonth % 12;
      return clampDay(year, month, paymentDay ?? d.getDate());
    }
    case PaymentFrequency.YEARLY:
      return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate());
    default:
      return new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
}

/** Limita el día al último día del mes para evitar desbordamiento */
function clampDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Parsea "YYYY-MM-DD" sin problemas de timezone */
function parseDateParts(dateStr: string): Date | null {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}
