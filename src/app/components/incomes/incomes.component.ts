import { Component, computed, inject, OnInit, signal, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, switchMap, of, from, concatMap, toArray } from 'rxjs';

import { DialogService } from '../../services/dialog.service';
import { AuthService } from '../../services/auth.service';
import { PaymentInstance } from '../../interfaces/payment-instance.interface';
import { Payment } from '../../interfaces/payment.interface';
import { PaymentCategory } from '../../interfaces/payment-category.interface';
import { DataTableComponent, TableColumn } from '../../shared/data-table/data-table.component';
import { MenuItem } from '../../shared/menu/menu.component';
import { BadgeOption } from '../../shared/badge/badge.component';
import { PaymentFormComponent, PaymentFormResult } from '../payment-form/payment-form.component';
import { PaymentDetailComponent } from '../payment-detail/payment-detail.component';
import {
  PaymentInstanceState,
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
import { generateFiniteInstanceDates, generateIndefiniteInstanceDates } from '../../utils/installment.util';

@Component({
  selector: 'app-incomes',
  imports: [CommonModule, FormsModule, DataTableComponent, PaymentFormComponent, PaymentDetailComponent],
  templateUrl: './incomes.component.html',
  styleUrls: ['./incomes.component.css'],
})
export class IncomesComponent implements OnInit {
  // --------------- Injects --------------- //
  private readonly paymentService = inject(PaymentService);
  private readonly dialogService = inject(DialogService);
  private readonly authService = inject(AuthService);

  // --------------- ViewChild --------------- //
  @ViewChild('incomeFormTemplate') incomeFormTemplate!: TemplateRef<any>;
  @ViewChild('detailTemplate') detailTemplate!: TemplateRef<any>;

  // --------------- Constants --------------- //
  readonly INCOME_TYPE_ID = 1;
  readonly viewModeOptions = VIEW_MODE_OPTIONS;

  readonly stateOptions: BadgeOption[] = Object.entries(PaymentInstanceStateLabels).map(
    ([key, label]) => ({ id: key, label, color: PaymentInstanceStateColors[key] ?? 'ghost' })
  );

  readonly columns: TableColumn[] = [
    { key: 'paymentDate', label: 'Fecha', type: 'date' },
    { key: 'description', label: 'Descripción' },
    { key: 'categoryName', label: 'Categoría' },
    { key: 'amount', label: 'Monto', type: 'currency' },
    { key: 'installmentInfo', label: 'Cuota', type: 'pill' },
    { key: 'stateLabel', label: 'Estado', type: 'badge', badgeColorKey: 'stateColor' },
    { key: 'comments', label: 'Comentarios' },
  ];

  readonly tableActions: MenuItem[] = [
    { id: 'detail', label: 'Detalle', icon: 'eye' },
    { id: 'edit', label: 'Editar', icon: 'pencil' },
    { id: 'delete', label: 'Eliminar', icon: 'trash' },
  ];

  // --------------- State --------------- //
  allInstances = signal<PaymentInstance[]>([]);
  payments = signal<Payment[]>([]);
  categories = signal<PaymentCategory[]>([]);
  isLoading = signal(true);

  viewMode = signal<ViewMode>('month');
  referenceDate = signal(new Date());
  searchQuery = signal('');
  selectedCategoryId = signal<number | null>(null);
  selectedState = signal<string | null>(null);
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Detail state
  selectedPayment = signal<Payment | null>(null);
  selectedInstances = signal<PaymentInstance[]>([]);
  selectedCategoryName = signal('—');

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
    const incomePaymentIds = new Set<number | string>(
      allPayments
        .filter((p) => p.paymentTypeId === this.INCOME_TYPE_ID)
        .map((p) => p.id)
    );
    console.log('[Ingresos] filteredInstances → payments cargados:', allPayments);
    console.log('[Ingresos] filteredInstances → incomePaymentIds (tipo 1):', [...incomePaymentIds]);
    console.log('[Ingresos] filteredInstances → instancias cargadas:', allInstances);
    console.log('[Ingresos] filteredInstances → rango de fecha:', { start, end });
    const result = allInstances.filter(
      (inst) =>
        inst.paymentDate >= start &&
        inst.paymentDate <= end &&
        incomePaymentIds.has(inst.paymentId)
    );
    console.log('[Ingresos] filteredInstances → resultado final:', result);
    return result;
  });

  tableData = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const catId = this.selectedCategoryId();
    const state = this.selectedState();
    const direction = this.sortDirection();

    let rows = this.filteredInstances().map((inst) => {
      const payment = this.payments().find((p) => p.id === inst.paymentId);
      const category = this.categories().find((c) => c.id === payment?.paymentCategoryId);
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
        paymentCategoryId: payment?.paymentCategoryId ?? 0,
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
          r.comments.toLowerCase().includes(query)
      );
    }
    if (catId) rows = rows.filter((r) => r.paymentCategoryId === catId);
    if (state) rows = rows.filter((r) => r.state === state);

    rows.sort((a, b) => {
      const diff = a.paymentDate.localeCompare(b.paymentDate);
      return direction === 'asc' ? diff : -diff;
    });
    return rows;
  });

  totalFiltered = computed(() => this.tableData().reduce((sum, r) => sum + r.amount, 0));

  incomeCategories = computed(() => {
    const catIds = new Set(
      this.payments()
        .filter((p) => p.paymentTypeId === this.INCOME_TYPE_ID)
        .map((p) => p.paymentCategoryId)
    );
    return this.categories().filter((c) => catIds.has(c.id));
  });

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
    }).subscribe({
      next: (data) => {
        console.log('[Ingresos] loadData result:', {
          categories: data.categories,
          payments: data.payments,
          instances: data.instances,
        });
        this.categories.set(data.categories);
        this.payments.set(data.payments);
        this.allInstances.set(data.instances);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando ingresos:', err);
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

  onCategoryChange(value: string): void {
    this.selectedCategoryId.set(value ? Number(value) : null);
  }

  onStateChange(value: string): void {
    this.selectedState.set(value || null);
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

  onTableAction(event: { actionId: string; item: any }): void {
    switch (event.actionId) {
      case 'detail': {
        const payment = this.payments().find((p) => p.id === event.item.paymentId);
        if (!payment) return;
        const instances = this.allInstances().filter((i) => i.paymentId === payment.id);
        const category = this.categories().find((c) => c.id === payment.paymentCategoryId);
        this.selectedPayment.set(payment);
        this.selectedInstances.set(instances);
        this.selectedCategoryName.set(category?.value ?? '—');
        this.dialogService.open({
          type: 'custom',
          title: 'Detalle del plan',
          templateRef: this.detailTemplate,
          wide: true,
          confirmText: 'Cerrar',
        });
        break;
      }
      case 'edit':
        this.dialogService.alert('Editar', 'Funcionalidad de edición próximamente.', 'info');
        break;
      case 'delete':
        this.dialogService
          .confirm('Eliminar ingreso', `¿Estás seguro de eliminar "${event.item.comments}"?`, 'error')
          .subscribe((confirmed) => {
            if (confirmed) {
              this.paymentService.deletePaymentInstance(event.item.id).subscribe(() => this.loadData());
            }
          });
        break;
    }
  }

  onAdd(): void {
    this.dialogService.open({
      type: 'custom',
      title: 'Nuevo ingreso',
      templateRef: this.incomeFormTemplate,
      wide: true,
    });
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
          // Creación secuencial para evitar race conditions en json-server
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
        error: (err) => console.error('Error creando ingreso:', err),
      });
  }

  onFormCancel(): void {
    this.dialogService.close();
  }

  private buildInstances(payment: Payment): any[] {
    const today = new Date().toISOString().split('T')[0];

    if (!payment.frequency) {
      // Pago único
      return [{
        paymentId: payment.id,
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
      // Recurrente finito → generar TODAS las cuotas
      dates = generateFiniteInstanceDates(
        payment.frequency, payment.startDate, payment.paymentDay, payment.installments
      );
      amount = Math.round((payment.totalAmount / payment.installments) * 100) / 100;
    } else {
      // Recurrente indefinido → generar hasta hoy
      dates = generateIndefiniteInstanceDates(
        payment.frequency, payment.startDate, payment.paymentDay, today
      );
      amount = payment.totalAmount;
    }

    return dates.map((date, index) => ({
      paymentId: payment.id,
      amount,
      paymentDate: date,
      installmentNumber: index + 1,
      state: date <= today ? PaymentInstanceState.PAID : PaymentInstanceState.PENDING,
      comments: payment.comments || '',
    }));
  }
}
