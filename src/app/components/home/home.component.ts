import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PaymentService } from '../../services/payment.service';
import { PaymentInstance } from '../../interfaces/payment-instance.interface';
import { Payment } from '../../interfaces/payment.interface';
import { PaymentType } from '../../interfaces/payment-type.interface';
import { PaymentCategory } from '../../interfaces/payment-category.interface';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-home',
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  // --------------- Injects --------------- //
  private readonly paymentService = inject(PaymentService);
  private readonly router = inject(Router);

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
}
