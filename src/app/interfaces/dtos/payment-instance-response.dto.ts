import { Payment } from '../payment.interface';

/** DTO de respuesta de una instancia de pago (entrante desde la API) */
export interface PaymentInstanceResponse {
  id: number;
  paymentId: number;
  amount: number;
  paymentDate: string;
  installmentNumber: number;
  state: string;
  comments: string;
  createdDate: string;
  updatedDate: string;
  isActive: boolean;
  payment?: Payment;
}
