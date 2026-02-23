/** DTO para crear o actualizar un Payment (petición saliente desde el front) */
export interface PaymentRequest {
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
}
