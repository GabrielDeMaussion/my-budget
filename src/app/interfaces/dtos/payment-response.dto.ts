import { PaymentCategory } from '../payment-category.interface';
import { PaymentType } from '../payment-type.interface';

/** DTO de respuesta de un Payment (entrante desde la API) */
export interface PaymentResponse {
  id: number;
  totalAmount: number;
  paymentTypeId: number;
  paymentCategoryId: number;
  startDate: string;
  endDate: string;
  frequency: string;
  state: string;
  comments: string;
  createdDate: string;
  updatedDate: string;
  isActive: boolean;
  paymentType?: PaymentType;
  paymentCategory?: PaymentCategory;
}
