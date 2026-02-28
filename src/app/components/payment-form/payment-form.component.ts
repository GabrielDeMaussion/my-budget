import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PaymentCategory } from '../../interfaces/payment-category.interface';
import { PaymentFrequency, PaymentFrequencyLabels } from '../../interfaces/enums/payment-frequency.enum';
import { PaymentState } from '../../interfaces/enums/payment-state.enum';
import { calculateInstallmentAmount } from '../../utils/installment.util';
import { PaymentService } from '../../services/payment.service';

export interface CategoryGroup {
  parent: PaymentCategory;
  children: PaymentCategory[];
}

export interface PaymentFormResult {
  payment: {
    totalAmount: number;
    paymentTypeId: number;
    paymentCategoryId: number;
    startDate: string;
    frequency: string | null;
    paymentDay: number | null;
    installments: number | null;
    state: string;
    comments: string;
  };
}

@Component({
  selector: 'app-payment-form',
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-form.component.html',
  styleUrls: ['./payment-form.component.css'],
})
export class PaymentFormComponent implements OnInit {
  // --------------- Injects --------------- //
  private readonly paymentService = inject(PaymentService);

  // --------------- Inputs --------------- //
  /** 1 = Ingreso, 2 = Gasto */
  paymentTypeId = input.required<number>();

  // --------------- Outputs --------------- //
  formSubmit = output<PaymentFormResult>();
  formCancel = output<void>();

  // --------------- State --------------- //
  categories = signal<PaymentCategory[]>([]);

  /** Categorías agrupadas: raíces con sus subcategorías */
  groupedCategories = computed<CategoryGroup[]>(() => {
    const cats = this.categories();
    const roots = cats.filter((c) => !c.parentId);
    return roots.map((parent) => ({
      parent,
      children: cats.filter((c) => c.parentId === parent.id),
    }));
  });

  /** '' = Único (se envía como null), el resto son valores del enum */
  readonly frequencyOptions: { value: string; label: string }[] = [
    { value: '', label: 'Único' },
    ...Object.entries(PaymentFrequencyLabels)
      .filter(([key]) => key !== PaymentFrequency.ONCE)
      .map(([key, label]) => ({ value: key, label })),
  ];

  /** Días del mes 1–28 */
  readonly daysOfMonth: number[] = Array.from({ length: 28 }, (_, i) => i + 1);

  /** Días de la semana (1=Lunes … 7=Domingo, convención ISO) */
  readonly daysOfWeek: { value: number; label: string }[] = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 7, label: 'Domingo' },
  ];

  // Form model
  form = {
    totalAmount: 0,
    paymentCategoryId: 0,
    frequency: '' as string,
    paymentDay: 1,
    startDate: new Date().toISOString().split('T')[0],
    startMonth: new Date().toISOString().slice(0, 7),
    isIndefinite: false,
    installments: 1,
    comments: '',
  };

  // --------------- Getters --------------- //
  get isOnce(): boolean {
    return this.form.frequency === '';
  }

  get isRecurring(): boolean {
    return !this.isOnce;
  }

  get isMonthly(): boolean {
    return this.form.frequency === PaymentFrequency.MONTHLY;
  }

  get isWeeklyOrBiweekly(): boolean {
    return (
      this.form.frequency === PaymentFrequency.WEEKLY ||
      this.form.frequency === PaymentFrequency.BIWEEKLY
    );
  }

  get isDaily(): boolean {
    return this.form.frequency === PaymentFrequency.DAILY;
  }

  get isYearly(): boolean {
    return this.form.frequency === PaymentFrequency.YEARLY;
  }

  /** Mostrar selector de día de pago (mensual, semanal, quincenal) */
  get showPaymentDay(): boolean {
    return this.isMonthly || this.isWeeklyOrBiweekly;
  }

  /** Label para el campo de día de pago */
  get paymentDayLabel(): string {
    if (this.isMonthly) return 'Día del mes';
    return 'Día de la semana';
  }

  /** Label para el campo de inicio */
  get startLabel(): string {
    if (this.isMonthly) return 'Mes de inicio';
    if (this.isYearly) return 'Primera fecha de cobro';
    return 'Fecha de inicio';
  }

  /** Monto sugerido por cuota */
  get suggestedInstallmentAmount(): number | null {
    if (!this.isRecurring || this.form.isIndefinite) return null;
    return calculateInstallmentAmount(this.form.totalAmount, this.form.installments);
  }

  // --------------- Init --------------- //
  ngOnInit(): void {
    this.paymentService.getPaymentCategories().subscribe((cats) => {
      this.categories.set(cats);
      const otros = cats.find((c) => c.value === 'Otros');
      this.form.paymentCategoryId = otros?.id ?? cats[cats.length - 1]?.id ?? 0;
    });
  }

  // --------------- Methods --------------- //
  onFrequencyChange(): void {
    // Resetear paymentDay al cambiar frecuencia
    if (this.isMonthly) {
      this.form.paymentDay = 1;
    } else if (this.isWeeklyOrBiweekly) {
      this.form.paymentDay = 1; // Lunes
    }
  }

  onSubmit(): void {
    if (!this.isValid()) return;

    const isOnce = this.isOnce;

    // Calcular startDate según frecuencia
    let startDate: string;
    if (isOnce) {
      startDate = this.form.startDate;
    } else if (this.isMonthly) {
      startDate = this.form.startMonth + '-01';
    } else {
      startDate = this.form.startDate;
    }

    // Calcular paymentDay
    let paymentDay: number | null = null;
    if (this.isMonthly || this.isWeeklyOrBiweekly) {
      paymentDay = this.form.paymentDay;
    }

    // Calcular installments
    let installments: number | null = null;
    if (!isOnce) {
      installments = this.form.isIndefinite ? null : this.form.installments;
    }

    this.formSubmit.emit({
      payment: {
        totalAmount: this.form.totalAmount,
        paymentTypeId: this.paymentTypeId(),
        paymentCategoryId: this.form.paymentCategoryId,
        startDate,
        frequency: isOnce ? null : this.form.frequency,
        paymentDay,
        installments,
        state: PaymentState.ACTIVE,
        comments: this.form.comments,
      },
    });
  }

  onCancel(): void {
    this.formCancel.emit();
  }

  isValid(): boolean {
    if (this.form.totalAmount <= 0) return false;

    if (this.isOnce) {
      return !!this.form.startDate;
    }

    // Recurring
    if (this.isMonthly) {
      if (!this.form.startMonth) return false;
    } else {
      if (!this.form.startDate) return false;
    }

    if (!this.form.isIndefinite && this.form.installments < 1) return false;

    return true;
  }
}
