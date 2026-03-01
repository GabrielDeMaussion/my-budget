import { Component, computed, inject, OnInit, signal, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PaymentService } from '../../services/payment.service';
import { DialogService } from '../../services/dialog.service';
import { AuthService } from '../../services/auth.service';
import { PaymentInstance } from '../../interfaces/payment-instance.interface';
import { Payment } from '../../interfaces/payment.interface';
import { PaymentType } from '../../interfaces/payment-type.interface';
import { PaymentCategory } from '../../interfaces/payment-category.interface';
import { forkJoin, switchMap, from, concatMap, toArray, of } from 'rxjs';
import { PaymentFormComponent, PaymentFormResult } from '../payment-form/payment-form.component';
import { generateFiniteInstanceDates, generateIndefiniteInstanceDatesFor5Years } from '../../utils/installment.util';
import { PaymentInstanceState } from '../../interfaces/enums/payment-instance-state.enum';

@Component({
  selector: 'app-home',
  imports: [CommonModule, PaymentFormComponent],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  // --------------- Injects --------------- //
  private readonly paymentService = inject(PaymentService);
  private readonly dialogService = inject(DialogService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // --------------- ViewChild --------------- //
  @ViewChild('incomeFormTemplate') incomeFormTemplate!: TemplateRef<any>;
  @ViewChild('expenseFormTemplate') expenseFormTemplate!: TemplateRef<any>;

  // --------------- State --------------- //
  instances = signal<PaymentInstance[]>([]);
  payments = signal<Payment[]>([]);
  paymentTypes = signal<PaymentType[]>([]);
  paymentCategories = signal<PaymentCategory[]>([]);
  isLoading = signal(true);

  // --------------- Computeds --------------- //
  currentMonth = computed(() => {
    const now = new Date();
    return now.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  });

  monthInstances = computed(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    return this.instances().filter((inst) => inst.paymentDate.startsWith(yearMonth));
  });

  totalIncome = computed(() => {
    return this.monthInstances()
      .filter((inst) => {
        const payment = this.payments().find((p) => p.id === inst.paymentId);
        return payment?.paymentTypeId === 1;
      })
      .reduce((sum, inst) => sum + inst.amount, 0);
  });

  totalExpenses = computed(() => {
    return this.monthInstances()
      .filter((inst) => {
        const payment = this.payments().find((p) => p.id === inst.paymentId);
        return payment?.paymentTypeId === 2;
      })
      .reduce((sum, inst) => sum + inst.amount, 0);
  });

  balance = computed(() => this.totalIncome() - this.totalExpenses());

  recentActivity = computed(() => {
    return this.monthInstances()
      .map((inst) => {
        const payment = this.payments().find((p) => p.id === inst.paymentId);
        const category = this.paymentCategories().find(
          (c) => c.id === payment?.paymentCategoryId
        );
        const type = this.paymentTypes().find((t) => t.id === payment?.paymentTypeId);
        return {
          ...inst,
          categoryName: category?.value ?? '—',
          typeName: type?.value ?? '—',
          isIncome: payment?.paymentTypeId === 1,
        };
      })
      .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
      .slice(0, 6);
  });

  incomeCount = computed(
    () =>
      this.monthInstances().filter((inst) => {
        const p = this.payments().find((p) => p.id === inst.paymentId);
        return p?.paymentTypeId === 1;
      }).length
  );

  expenseCount = computed(
    () =>
      this.monthInstances().filter((inst) => {
        const p = this.payments().find((p) => p.id === inst.paymentId);
        return p?.paymentTypeId === 2;
      }).length
  );

  // --------------- Init --------------- //
  ngOnInit(): void {
    this.loadData();
  }

  // --------------- Methods --------------- //
  loadData(): void {
    this.isLoading.set(true);
    forkJoin({
      types: this.paymentService.getPaymentTypes(),
      categories: this.paymentService.getPaymentCategories(),
      payments: this.paymentService.getPayments(),
      instances: this.paymentService.getPaymentInstances(),
    }).subscribe({
      next: (data) => {
        console.log('[Home] loadData result:', {
          types: data.types,
          categories: data.categories,
          payments: data.payments,
          instances: data.instances,
        });
        this.paymentTypes.set(data.types);
        this.paymentCategories.set(data.categories);
        this.payments.set(data.payments);
        this.instances.set(data.instances);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando datos del dashboard:', err);
        this.isLoading.set(false);
      },
    });
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  // --------------- Quick Actions / Form --------------- //
  openIncomeForm(): void {
    this.dialogService.open({
      type: 'custom',
      title: 'Nuevo ingreso',
      templateRef: this.incomeFormTemplate,
      wide: true,
    });
  }

  openExpenseForm(): void {
    this.dialogService.open({
      type: 'custom',
      title: 'Nuevo gasto',
      templateRef: this.expenseFormTemplate,
      wide: true,
    });
  }

  onFormCancel(): void {
    this.dialogService.close();
  }

  onFormSubmit(result: PaymentFormResult): void {
    const user = this.authService.authUser();
    if (!user) return;

    const paymentReq = {
      ...result.payment,
      userId: Number(user.sub),
    };

    this.paymentService
      .createPayment(paymentReq)
      .pipe(
        switchMap((payment) => {
          const instances = this.buildInstances(payment);
          if (instances.length === 0) return of([]);
          return from(instances).pipe(
            concatMap((inst) => this.paymentService.createPaymentInstance(inst)),
            toArray()
          );
        })
      )
      .subscribe({
        next: () => {
          this.dialogService.close();
          this.loadData();
        },
        error: (err) => console.error('Error creando pago:', err),
      });
  }

  private buildInstances(payment: Payment): any[] {
    const today = new Date().toISOString().split('T')[0];

    if (!payment.frequency) {
      return [{
        paymentId: payment.id!,
        amount: payment.totalAmount,
        paymentDate: payment.startDate,
        installmentNumber: 1,
        state: payment.startDate <= today ? PaymentInstanceState.PAID : PaymentInstanceState.PENDING,
        comments: payment.comments || '',
      }];
    }

    let dates: string[];
    let amount: number;

    if (payment.installments) {
      dates = generateFiniteInstanceDates(
        payment.frequency, payment.startDate, payment.paymentDay, payment.installments
      );
      amount = Math.round((payment.totalAmount / payment.installments) * 100) / 100;
    } else {
      dates = generateIndefiniteInstanceDatesFor5Years(
        payment.frequency, payment.startDate, payment.paymentDay
      );
      amount = payment.totalAmount;
    }

    return dates.map((date, index) => ({
      paymentId: payment.id!,
      amount,
      paymentDate: date,
      installmentNumber: index + 1,
      state: date <= today ? PaymentInstanceState.PAID : PaymentInstanceState.PENDING,
      comments: payment.comments || '',
    }));
  }
}
