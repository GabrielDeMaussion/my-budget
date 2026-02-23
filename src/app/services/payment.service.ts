import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { Payment } from '../interfaces/payment.interface';
import { PaymentInstance } from '../interfaces/payment-instance.interface';
import { PaymentType } from '../interfaces/payment-type.interface';
import { PaymentCategory } from '../interfaces/payment-category.interface';
import { PaymentRequest } from '../interfaces/dtos/payment-request.dto';
import { PaymentInstanceRequest } from '../interfaces/dtos/payment-instance-request.dto';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  // --------------- Injects --------------- //
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  // --------------- Helpers --------------- //
  /** json-server v1+ devuelve IDs variados; normalizamos con seguridad.
   * Solo convierte a número si el string es puramente dígitos (evita que "89e9"
   * sea interpretado como notación científica 89×10⁹). */
  private normalizeId<T extends { id: any }>(item: T): T {
    const idStr = String(item.id);
    const num = Number(idStr);
    const isPureInt = /^\d+$/.test(idStr) && Number.isFinite(num);
    return { ...item, id: isPureInt ? num : item.id };
  }

  private normalizeIds<T extends { id: any }>(items: T[]): T[] {
    return items.map((item) => this.normalizeId(item));
  }

  /** Normaliza id y paymentId de instancias para asegurar consistencia de tipos */
  private normalizeInstanceIds(items: PaymentInstance[]): PaymentInstance[] {
    return items.map((item) => {
      const normalized = this.normalizeId(item);
      const payIdStr = String(normalized.paymentId);
      const numPayId = Number(payIdStr);
      const isPureInt = /^\d+$/.test(payIdStr) && Number.isFinite(numPayId);
      return { ...normalized, paymentId: isPureInt ? numPayId : normalized.paymentId };
    });
  }

  private normalizeInstanceId(item: PaymentInstance): PaymentInstance {
    const normalized = this.normalizeId(item);
    const payIdStr = String(normalized.paymentId);
    const numPayId = Number(payIdStr);
    const isPureInt = /^\d+$/.test(payIdStr) && Number.isFinite(numPayId);
    return { ...normalized, paymentId: isPureInt ? numPayId : normalized.paymentId };
  }

  // --------------- Payment Types --------------- //
  getPaymentTypes(): Observable<PaymentType[]> {
    return this.http.get<PaymentType[]>(`${this.apiUrl}/paymentTypes`).pipe(
      map((items) => this.normalizeIds(items))
    );
  }

  // --------------- Payment Categories --------------- //
  getPaymentCategories(): Observable<PaymentCategory[]> {
    return this.http.get<PaymentCategory[]>(`${this.apiUrl}/paymentCategories`).pipe(
      map((items) => this.normalizeIds(items))
    );
  }

  createPaymentCategory(dto: { value: string }): Observable<PaymentCategory> {
    return this.http.post<PaymentCategory>(`${this.apiUrl}/paymentCategories`, dto).pipe(
      map((item) => this.normalizeId(item))
    );
  }

  updatePaymentCategory(id: number | string, dto: Partial<{ value: string }>): Observable<PaymentCategory> {
    return this.http.patch<PaymentCategory>(`${this.apiUrl}/paymentCategories/${id}`, dto).pipe(
      map((item) => this.normalizeId(item))
    );
  }

  deletePaymentCategory(id: number | string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/paymentCategories/${id}`);
  }

  // --------------- Payments --------------- //
  getPayments(): Observable<Payment[]> {
    console.log('[PaymentService] GET /payments (sin filtro)');
    return this.http.get<Payment[]>(`${this.apiUrl}/payments`).pipe(
      tap((raw) => console.log('[PaymentService] GET /payments RAW:', raw)),
      map((items) => this.normalizeIds(items)),
      tap((normalized) => console.log('[PaymentService] GET /payments normalizado:', normalized))
    );
  }

  getPaymentsByUser(userId: number | string): Observable<Payment[]> {
    console.log(`[PaymentService] GET /payments?userId=${userId}`);
    return this.http.get<Payment[]>(`${this.apiUrl}/payments?userId=${userId}`).pipe(
      tap((raw) => console.log(`[PaymentService] GET /payments?userId=${userId} RAW:`, raw)),
      map((items) => this.normalizeIds(items)),
      tap((normalized) => console.log(`[PaymentService] GET /payments?userId=${userId} normalizado:`, normalized))
    );
  }

  getPaymentsByType(typeId: number): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.apiUrl}/payments?paymentTypeId=${typeId}`).pipe(
      map((items) => this.normalizeIds(items))
    );
  }

  getPaymentById(id: number): Observable<Payment> {
    return this.http.get<Payment>(`${this.apiUrl}/payments/${id}`).pipe(
      map((item) => this.normalizeId(item))
    );
  }

  createPayment(dto: PaymentRequest): Observable<Payment> {
    const now = new Date().toISOString().split('T')[0];
    const body = { ...dto, createdDate: now, updatedDate: now, isActive: true };
    console.log('[PaymentService] POST /payments body:', body);
    return this.http.post<Payment>(`${this.apiUrl}/payments`, body).pipe(
      tap((raw) => console.log('[PaymentService] POST /payments RAW response:', raw)),
      map((item) => this.normalizeId(item)),
      tap((normalized) => console.log('[PaymentService] POST /payments normalizado:', normalized))
    );
  }

  updatePayment(id: number, dto: Partial<PaymentRequest>): Observable<Payment> {
    return this.http.patch<Payment>(`${this.apiUrl}/payments/${id}`, {
      ...dto,
      updatedDate: new Date().toISOString().split('T')[0],
    });
  }

  deletePayment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/payments/${id}`);
  }

  // --------------- Payment Instances --------------- //
  getPaymentInstances(): Observable<PaymentInstance[]> {
    console.log('[PaymentService] GET /paymentInstances');
    return this.http.get<PaymentInstance[]>(`${this.apiUrl}/paymentInstances`).pipe(
      tap((raw) => console.log('[PaymentService] GET /paymentInstances RAW:', raw)),
      map((items) => this.normalizeInstanceIds(items)),
      tap((normalized) => console.log('[PaymentService] GET /paymentInstances normalizado:', normalized))
    );
  }

  getPaymentInstanceById(id: number | string): Observable<PaymentInstance> {
    return this.http.get<PaymentInstance>(`${this.apiUrl}/paymentInstances/${id}`).pipe(
      map((item) => this.normalizeInstanceId(item))
    );
  }

  createPaymentInstance(dto: PaymentInstanceRequest): Observable<PaymentInstance> {
    const now = new Date().toISOString().split('T')[0];
    const body = { ...dto, createdDate: now, updatedDate: now, isActive: true };
    console.log('[PaymentService] POST /paymentInstances body:', body);
    return this.http.post<PaymentInstance>(`${this.apiUrl}/paymentInstances`, body).pipe(
      tap((raw) => console.log('[PaymentService] POST /paymentInstances RAW response:', raw)),
      map((item) => this.normalizeInstanceId(item)),
      tap((normalized) => console.log('[PaymentService] POST /paymentInstances normalizado:', normalized))
    );
  }

  updatePaymentInstance(id: number | string, dto: Partial<PaymentInstanceRequest>): Observable<PaymentInstance> {
    return this.http.patch<PaymentInstance>(`${this.apiUrl}/paymentInstances/${id}`, {
      ...dto,
      updatedDate: new Date().toISOString().split('T')[0],
    });
  }

  deletePaymentInstance(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/paymentInstances/${id}`);
  }
}
