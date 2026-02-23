import { Audit } from './audit.interface';
import { Payment } from './payment.interface';

/**
 * Interfaz para la instancia de un pago (ocurrencia concreta de un Payment)
 *
 * Atributos:
 * - paymentId: FK → Payment
 * - amount: Monto de esta instancia
 * - paymentDate: Fecha del pago
 * - installmentNumber: Número de cuota
 * - state: Estado de la instancia (enum PaymentInstanceState)
 * - comments: Comentarios adicionales
 * - payment: Relación expandida (opcional)
 */
export interface PaymentInstance extends Audit {
  paymentId: number | string;
  amount: number;
  paymentDate: string;
  installmentNumber: number;
  state: string;
  comments: string;
  payment?: Payment;
}
