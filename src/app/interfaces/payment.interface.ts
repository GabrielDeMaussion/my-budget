import { Audit } from './audit.interface';
import { PaymentCategory } from './payment-category.interface';
import { PaymentType } from './payment-type.interface';

/**
 * Interfaz para la entidad Payment (plantilla de pago recurrente o único)
 *
 * Atributos:
 * - totalAmount: Monto total del pago (total para finito, monto por período para indefinido)
 * - paymentTypeId: FK → PaymentType
 * - paymentCategoryId: FK → PaymentCategory
 * - userId: FK → User (propietario del pago)
 * - startDate: Fecha de inicio (YYYY-MM-DD)
 * - frequency: Frecuencia del pago (enum PaymentFrequency, null = único)
 * - paymentDay: Día de cobro según frecuencia (1-28 mensual, 1-7 semanal, null para diario/anual/único)
 * - installments: Cantidad de cuotas (null = indefinido)
 * - state: Estado del pago (enum PaymentState)
 * - comments: Comentarios / descripción
 * - paymentType: Relación expandida (opcional)
 * - paymentCategory: Relación expandida (opcional)
 */
export interface Payment extends Audit {
  totalAmount: number;
  paymentTypeId: number;
  paymentCategoryId: number;
  userId: number | string;
  startDate: string;
  frequency: string | null;
  paymentDay: number | null;
  installments: number | null;
  state: string;
  comments: string;
  paymentType?: PaymentType;
  paymentCategory?: PaymentCategory;
}
