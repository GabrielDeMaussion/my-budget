import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';

import { Payment } from '../interfaces/payment.interface';
import { PaymentInstance } from '../interfaces/payment-instance.interface';
import { PaymentType } from '../interfaces/payment-type.interface';
import { PaymentCategory } from '../interfaces/payment-category.interface';
import { PaymentRequest } from '../interfaces/dtos/payment-request.dto';
import { PaymentInstanceRequest } from '../interfaces/dtos/payment-instance-request.dto';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  // --------------- Injects --------------- //
  private readonly db = inject(DatabaseService);

  // --------------- Payment Types --------------- //
  getPaymentTypes(): Observable<PaymentType[]> {
    return from(this.db.getAll<PaymentType>('paymentTypes'));
  }

  // --------------- Payment Categories --------------- //
  getPaymentCategories(): Observable<PaymentCategory[]> {
    return from(this.db.getAll<PaymentCategory>('paymentCategories'));
  }

  createPaymentCategory(dto: { value: string }): Observable<PaymentCategory> {
    return from(this.db.add<PaymentCategory>('paymentCategories', dto as PaymentCategory));
  }

  updatePaymentCategory(id: number | string, dto: Partial<{ value: string }>): Observable<PaymentCategory> {
    return from(this.db.update<PaymentCategory>('paymentCategories', id, dto));
  }

  deletePaymentCategory(id: number | string): Observable<void> {
    return from(this.db.delete('paymentCategories', id));
  }

  // --------------- Payments --------------- //
  getPayments(): Observable<Payment[]> {
    return from(this.db.getAll<Payment>('payments'));
  }

  getPaymentsByUser(userId: number | string): Observable<Payment[]> {
    return from(this.db.getByIndex<Payment>('payments', 'userId', Number(userId)));
  }

  getPaymentsByType(typeId: number): Observable<Payment[]> {
    return from(this.db.getByIndex<Payment>('payments', 'paymentTypeId', Number(typeId)));
  }

  getPaymentById(id: number): Observable<Payment> {
    return from(this.db.getById<Payment>('payments', id));
  }

  createPayment(dto: PaymentRequest): Observable<Payment> {
    const now = new Date().toISOString().split('T')[0];
    const body: Omit<Payment, 'id'> = {
      ...dto,
      createdDate: now,
      updatedDate: now,
      isActive: true,
      userId: Number(dto.userId)
    };
    return from(this.db.add('payments', body as Payment));
  }

  updatePayment(id: number, dto: Partial<PaymentRequest>): Observable<Payment> {
    return from(this.db.update<Payment>('payments', id, {
      ...dto,
      updatedDate: new Date().toISOString().split('T')[0],
    }));
  }

  deletePayment(id: number): Observable<void> {
    return from(this.db.delete('payments', id));
  }

  // --------------- Payment Instances --------------- //
  getPaymentInstances(): Observable<PaymentInstance[]> {
    return from(this.db.getAll<PaymentInstance>('paymentInstances'));
  }

  getPaymentInstanceById(id: number | string): Observable<PaymentInstance> {
    return from(this.db.getById<PaymentInstance>('paymentInstances', id));
  }

  createPaymentInstance(dto: PaymentInstanceRequest): Observable<PaymentInstance> {
    const now = new Date().toISOString().split('T')[0];
    const body: Omit<PaymentInstance, 'id'> = {
      ...dto,
      createdDate: now,
      updatedDate: now,
      isActive: true,
      paymentId: Number(dto.paymentId)
    };
    return from(this.db.add('paymentInstances', body as PaymentInstance));
  }

  updatePaymentInstance(id: number | string, dto: Partial<PaymentInstanceRequest>): Observable<PaymentInstance> {
    return from(this.db.update<PaymentInstance>('paymentInstances', id, {
      ...dto,
      updatedDate: new Date().toISOString().split('T')[0],
    }));
  }

  deletePaymentInstance(id: number): Observable<void> {
    return from(this.db.delete('paymentInstances', id));
  }

  deletePaymentInstanceById(id: number | string): Observable<void> {
    return from(this.db.delete('paymentInstances', id));
  }
}
