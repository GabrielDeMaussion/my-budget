import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { PaymentInstance } from '../../interfaces/payment-instance.interface';
import { Payment } from '../../interfaces/payment.interface';
import { PaymentCategory } from '../../interfaces/payment-category.interface';
import { PaymentType } from '../../interfaces/payment-type.interface';
import { DataTableComponent, TableColumn } from '../../shared/data-table/data-table.component';
import { BadgeOption } from '../../shared/badge/badge.component';
import {
  getInstanceStateLabel,
  getInstanceStateColor,
  PaymentInstanceStateLabels,
  PaymentInstanceStateColors,
} from '../../interfaces/enums/payment-instance-state.enum';
import {
  ViewMode,
  VIEW_MODE_OPTIONS,
  getDateRange,
  getNavigationLabel,
  navigateDate,
} from '../../utils/date-navigation.util';
import { PaymentService } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-summary',
  imports: [CommonModule, FormsModule, DataTableComponent],
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.css'],
})
export class SummaryComponent implements OnInit {
  // --------------- Injects --------------- //
  private readonly paymentService = inject(PaymentService);
  private readonly authService = inject(AuthService);

  // --------------- Constants --------------- //
  private readonly INCOME_TYPE_ID = 1;
  private readonly EXPENSE_TYPE_ID = 2;

  readonly viewModeOptions = VIEW_MODE_OPTIONS;

  readonly stateOptions: BadgeOption[] = Object.entries(PaymentInstanceStateLabels).map(
    ([key, label]) => ({ id: key, label, color: PaymentInstanceStateColors[key] ?? 'ghost' })
  );

  readonly columns: TableColumn[] = [
    { key: 'paymentDate', label: 'Fecha', type: 'date' },
    { key: 'typeName', label: 'Tipo', type: 'badge', badgeColorKey: 'typeColor' },
    { key: 'description', label: 'Descripción' },
    { key: 'categoryName', label: 'Categoría' },
    { key: 'amount', label: 'Monto', type: 'currency' },
    { key: 'installmentInfo', label: 'Cuota', type: 'pill' },
    { key: 'stateLabel', label: 'Estado', type: 'badge', badgeColorKey: 'stateColor' },
  ];

  // --------------- State --------------- //
  allInstances = signal<PaymentInstance[]>([]);
  payments = signal<Payment[]>([]);
  categories = signal<PaymentCategory[]>([]);
  paymentTypes = signal<PaymentType[]>([]);
  isLoading = signal(true);

  viewMode = signal<ViewMode>('month');
  referenceDate = signal(new Date());
  searchQuery = signal('');
  selectedType = signal<string | null>(null);
  sortDirection = signal<'asc' | 'desc'>('asc');

  // --------------- Computeds --------------- //
  dateRange = computed(() => getDateRange(this.referenceDate(), this.viewMode()));
  navigationLabel = computed(() => getNavigationLabel(this.referenceDate(), this.viewMode()));

  columnsWithOptions = computed(() =>
    this.columns.map((col) =>
      col.key === 'stateLabel' ? { ...col, badgeOptions: this.stateOptions } : col
    )
  );

  filteredInstances = computed(() => {
    const { start, end } = this.dateRange();
    const allPayments = this.payments();
    const allInstances = this.allInstances();
    console.log('[Resumen] filteredInstances → payments cargados:', allPayments);
    console.log('[Resumen] filteredInstances → instancias cargadas:', allInstances);
    console.log('[Resumen] filteredInstances → rango de fecha:', { start, end });
    const result = allInstances.filter(
      (inst) => inst.paymentDate >= start && inst.paymentDate <= end
    );
    console.log('[Resumen] filteredInstances → resultado final:', result);
    return result;
  });

  tableData = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const typeFilter = this.selectedType();
    const direction = this.sortDirection();

    let rows = this.filteredInstances().map((inst) => {
      const payment = this.payments().find((p) => p.id === inst.paymentId);
      const category = this.categories().find((c) => c.id === payment?.paymentCategoryId);
      const isIncome = payment?.paymentTypeId === this.INCOME_TYPE_ID;
      const totalInstallments = payment?.installments ?? null;

      let installmentInfo: string;
      if (!payment?.frequency) {
        installmentInfo = '—';
      } else if (totalInstallments === null) {
        installmentInfo = `${inst.installmentNumber}/∞`;
      } else {
        installmentInfo =
          totalInstallments > 1 ? `${inst.installmentNumber}/${totalInstallments}` : '—';
      }

      return {
        ...inst,
        description: payment?.comments ?? '—',
        categoryName: category?.value ?? '—',
        typeName: isIncome ? 'Ingreso' : 'Gasto',
        typeColor: isIncome ? 'success' : 'error',
        paymentTypeId: payment?.paymentTypeId ?? 0,
        stateLabel: getInstanceStateLabel(inst.state),
        stateColor: getInstanceStateColor(inst.state),
        installmentInfo,
      };
    });

    if (query) {
      rows = rows.filter(
        (r) =>
          r.description.toLowerCase().includes(query) ||
          r.categoryName.toLowerCase().includes(query) ||
          r.typeName.toLowerCase().includes(query)
      );
    }
    if (typeFilter) {
      const typeId = typeFilter === 'income' ? this.INCOME_TYPE_ID : this.EXPENSE_TYPE_ID;
      rows = rows.filter((r) => r.paymentTypeId === typeId);
    }

    rows.sort((a, b) => {
      const diff = a.paymentDate.localeCompare(b.paymentDate);
      return direction === 'asc' ? diff : -diff;
    });

    return rows;
  });

  totalIncome = computed(() =>
    this.tableData()
      .filter((r) => r.paymentTypeId === this.INCOME_TYPE_ID)
      .reduce((sum, r) => sum + r.amount, 0)
  );

  totalExpense = computed(() =>
    this.tableData()
      .filter((r) => r.paymentTypeId === this.EXPENSE_TYPE_ID)
      .reduce((sum, r) => sum + r.amount, 0)
  );

  balance = computed(() => this.totalIncome() - this.totalExpense());
  balanceColor = computed(() => (this.balance() >= 0 ? 'text-success' : 'text-error'));

  // --------------- Init --------------- //
  ngOnInit(): void {
    this.loadData();
  }

  // --------------- Methods --------------- //
  loadData(): void {
    const user = this.authService.authUser();
    if (!user) {
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    forkJoin({
      categories: this.paymentService.getPaymentCategories(),
      payments: this.paymentService.getPaymentsByUser(user.sub),
      instances: this.paymentService.getPaymentInstances(),
      types: this.paymentService.getPaymentTypes(),
    }).subscribe({
      next: (data) => {
        console.log('[Resumen] loadData result:', {
          categories: data.categories,
          payments: data.payments,
          instances: data.instances,
          types: data.types,
        });
        this.categories.set(data.categories);
        this.payments.set(data.payments);
        this.allInstances.set(data.instances);
        this.paymentTypes.set(data.types);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando resumen:', err);
        this.isLoading.set(false);
      },
    });
  }

  prev(): void {
    this.referenceDate.set(navigateDate(this.referenceDate(), this.viewMode(), -1));
  }

  next(): void {
    this.referenceDate.set(navigateDate(this.referenceDate(), this.viewMode(), 1));
  }

  resetToToday(): void {
    this.referenceDate.set(new Date());
  }

  onViewModeChange(value: string): void {
    this.viewMode.set(value as ViewMode);
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
  }

  onTypeChange(value: string): void {
    this.selectedType.set(value || null);
  }

  toggleSort(): void {
    this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
  }

  onBadgeOptionClicked(event: { column: string; item: any; optionId: string }): void {
    if (event.column === 'stateLabel') {
      this.paymentService
        .updatePaymentInstance(event.item.id, { state: event.optionId })
        .subscribe(() => this.loadData());
    }
  }
}
