/** DTO para crear o actualizar una instancia de pago (petición saliente desde el front) */
export interface PaymentInstanceRequest {
  paymentId: number | string;
  amount: number;
  paymentDate: string;
  installmentNumber: number;
  state: string;
  comments: string;
}
