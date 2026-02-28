import { Component, computed, inject, OnInit, signal, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, switchMap, of, from, concatMap, toArray, EMPTY } from 'rxjs';

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
import { InstanceEditFormComponent, InstanceEditResult } from '../instance-edit-form/instance-edit-form.component';
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
import { generateFiniteInstanceDates, generateIndefiniteInstanceDatesFor5Years } from '../../utils/installment.util';
import { getCategoryDisplayName, getParentCategoryName, getParentCategoryId } from '../../utils/category.util';

@Component({
  selector: 'app-expenses',
  imports: [CommonModule, FormsModule, DataTableComponent, PaymentFormComponent, PaymentDetailComponent, InstanceEditFormComponent],
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.css'],
})
export class ExpensesComponent implements OnInit {
  // --------------- Injects --------------- //
  private readonly paymentService = inject(PaymentService);
  private readonly dialogService = inject(DialogService);
  private readonly authService = inject(AuthService);

  // --------------- ViewChild --------------- //
  @ViewChild('expenseFormTemplate') expenseFormTemplate!: TemplateRef<any>;
  @ViewChild('detailTemplate') detailTemplate!: TemplateRef<any>;
  @ViewChild('editFormTemplate') editFormTemplate!: TemplateRef<any>;

  // --------------- Constants --------------- //
  readonly EXPENSE_TYPE_ID = 2;
  readonly viewModeOptions = VIEW_MODE_OPTIONS;

  readonly stateOptions: BadgeOption[] = Object.entries(PaymentInstanceStateLabels).map(
    ([key, label]) => ({ id: key, label, color: PaymentInstanceStateColors[key] ?? 'ghost' })
  );

  readonly columns: TableColumn[] = [
    { key: 'paymentDate', label: 'Fecha', type: 'date', align: 'center' },
    { key: 'description', label: 'Descripción', align: 'left' },
    { key: 'categoryName', label: 'Categoría', align: 'left' },
    { key: 'amount', label: 'Monto', type: 'currency', align: 'right' },
    { key: 'installmentInfo', label: 'Cuota', type: 'pill', align: 'center' },
    { key: 'stateLabel', label: 'Estado', type: 'badge', badgeColorKey: 'stateColor', align: 'center' },
    { key: 'comments', label: 'Comentarios', align: 'left' },
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

  // Edit state
  editingItem = signal<any>(null);

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
    const expensePaymentIds = new Set<number | string>(
      allPayments
        .filter((p) => p.paymentTypeId === this.EXPENSE_TYPE_ID)
        .map((p) => p.id!)
    );
    console.log('[Gastos] filteredInstances → payments cargados:', allPayments);
    console.log('[Gastos] filteredInstances → expensePaymentIds (tipo 2):', [...expensePaymentIds]);
    console.log('[Gastos] filteredInstances → instancias cargadas:', allInstances);
    console.log('[Gastos] filteredInstances → rango de fecha:', { start, end });
    const result = allInstances.filter(
      (inst) =>
        inst.paymentDate >= start &&
        inst.paymentDate <= end &&
        expensePaymentIds.has(inst.paymentId)
    );
    console.log('[Gastos] filteredInstances → resultado final:', result);
    return result;
  });

  tableData = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const catId = this.selectedCategoryId();
    const state = this.selectedState();
    const direction = this.sortDirection();

    let rows = this.filteredInstances().map((inst) => {
      const payment = this.payments().find((p) => p.id === inst.paymentId);
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
        categoryName: getParentCategoryName(payment?.paymentCategoryId, this.categories()),
        parentCategoryId: getParentCategoryId(payment?.paymentCategoryId, this.categories()) ?? 0,
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
    if (catId) rows = rows.filter((r) => r.parentCategoryId === catId);
    if (state) rows = rows.filter((r) => r.state === state);

    rows.sort((a, b) => {
      const diff = a.paymentDate.localeCompare(b.paymentDate);
      return direction === 'asc' ? diff : -diff;
    });
    return rows;
  });

  totalFiltered = computed(() => this.tableData().reduce((sum, r) => sum + r.amount, 0));

  expenseCategories = computed(() => {
    const catIds = new Set(
      this.payments()
        .filter((p) => p.paymentTypeId === this.EXPENSE_TYPE_ID)
        .map((p) => {
          // Get the root/parent category id
          return getParentCategoryId(p.paymentCategoryId, this.categories());
        })
        .filter((id): id is number => id !== undefined)
    );
    return this.categories().filter((c) => !c.parentId && catIds.has(c.id!));
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
        console.log('[Gastos] loadData result:', {
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
        console.error('Error cargando gastos:', err);
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
        .pipe(
          switchMap(() => {
            // Auto-complete: check if all instances of the plan are now PAID
            const payment = this.payments().find((p) => p.id === event.item.paymentId);
            if (!payment || !payment.frequency) return of(null);

            const planInstances = this.allInstances().filter((i) => i.paymentId === payment.id);
            // Simulate the update: replace this instance's state in the check
            const allPaid = planInstances.every((i) =>
              i.id === event.item.id ? event.optionId === 'PAID' : i.state === 'PAID'
            );

            if (allPaid && payment.state !== 'COMPLETED') {
              return this.paymentService.updatePayment(payment.id!, { state: 'COMPLETED' });
            } else if (!allPaid && payment.state === 'COMPLETED') {
              return this.paymentService.updatePayment(payment.id!, { state: 'ACTIVE' });
            }
            return of(null);
          })
        )
        .subscribe(() => this.loadData());
    }
  }

  onTableAction(event: { actionId: string; item: any }): void {
    switch (event.actionId) {
      case 'detail': {
        const payment = this.payments().find((p) => p.id === event.item.paymentId);
        if (!payment) return;
        const instances = this.allInstances().filter((i) => i.paymentId === payment.id);
        this.selectedPayment.set(payment);
        this.selectedInstances.set(instances);
        this.selectedCategoryName.set(getCategoryDisplayName(payment.paymentCategoryId, this.categories()));
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
        this.handleEdit(event.item);
        break;
      case 'delete':
        this.handleDelete(event.item);
        break;
    }
  }

  /**
   * Eliminación selectiva (forward-only).
   * Para pagos indefinidos: elimina el registro actual y todos los futuros de la serie.
   * Para otros pagos: elimina solo la instancia seleccionada.
   * Nunca toca registros anteriores (protección de histórico).
   */
  private handleDelete(item: any): void {
    const payment = this.payments().find((p) => p.id === item.paymentId);
    const isIndefinite = payment?.frequency && !payment?.installments;

    if (isIndefinite) {
      // Obtener las instancias futuras (>= fecha de la seleccionada)
      const futureInstances = this.allInstances()
        .filter((i) => i.paymentId === item.paymentId && i.paymentDate >= item.paymentDate)
        .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

      const count = futureInstances.length;
      this.dialogService
        .confirm(
          'Eliminar gasto indefinido',
          `Se eliminarán ${count} registro(s): el seleccionado y todos los futuros de esta serie. Los registros anteriores NO se verán afectados. ¿Continuar?`,
          'error'
        )
        .subscribe((confirmed) => {
          if (confirmed) {
            from(futureInstances).pipe(
              concatMap((inst) => this.paymentService.deletePaymentInstanceById(inst.id!)),
              toArray()
            ).subscribe(() => this.loadData());
          }
        });
    } else {
      this.dialogService
        .confirm('Eliminar gasto', `¿Estás seguro de eliminar "${item.comments}"?`, 'error')
        .subscribe((confirmed) => {
          if (confirmed) {
            this.paymentService.deletePaymentInstanceById(item.id).subscribe(() => this.loadData());
          }
        });
    }
  }

  /**
   * Modificación selectiva (forward-only).
   * Para pagos indefinidos: el cambio se aplica al registro actual y todos los futuros.
   * Para otros pagos: edita solo la instancia seleccionada.
   * Nunca toca registros anteriores (protección de histórico).
   */
  private handleEdit(item: any): void {
    this.editingItem.set(item);
    this.dialogService.open({
      type: 'custom',
      title: 'Editar gasto',
      templateRef: this.editFormTemplate,
      wide: true,
    });
  }

  onEditFormSubmit(result: InstanceEditResult): void {
    const item = this.editingItem();
    if (!item) return;

    const payment = this.payments().find((p) => p.id === item.paymentId);
    const isIndefinite = payment?.frequency && !payment?.installments;

    // Update category on the Payment if it changed
    const categoryChanged = payment && result.paymentCategoryId !== payment.paymentCategoryId;
    const updateCategory$ = categoryChanged
      ? this.paymentService.updatePayment(payment.id!, { paymentCategoryId: result.paymentCategoryId }).pipe(switchMap(() => of(void 0)))
      : of(void 0);

    if (isIndefinite) {
      const futureInstances = this.allInstances()
        .filter((i) => i.paymentId === item.paymentId && i.paymentDate >= item.paymentDate)
        .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));

      const count = futureInstances.length;
      this.dialogService.close();
      this.dialogService
        .confirm(
          'Editar gasto indefinido',
          `Se modificarán ${count} registro(s): el seleccionado y todos los futuros de esta serie. Los registros anteriores NO se verán afectados. ¿Continuar?`,
          'info'
        )
        .subscribe((confirmed) => {
          if (confirmed) {
            updateCategory$.pipe(
              switchMap(() =>
                from(futureInstances).pipe(
                  concatMap((inst) =>
                    this.paymentService.updatePaymentInstance(inst.id!, {
                      amount: result.amount,
                      comments: result.comments,
                    })
                  ),
                  toArray()
                )
              )
            ).subscribe(() => this.loadData());
          }
        });
    } else {
      this.dialogService.close();
      updateCategory$.pipe(
        switchMap(() =>
          this.paymentService.updatePaymentInstance(item.id, { amount: result.amount, comments: result.comments })
        )
      ).subscribe(() => this.loadData());
    }
    this.editingItem.set(null);
  }

  onEditFormCancel(): void {
    this.editingItem.set(null);
    this.dialogService.close();
  }

  onAdd(): void {
    this.dialogService.open({
      type: 'custom',
      title: 'Nuevo gasto',
      templateRef: this.expenseFormTemplate,
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
        error: (err) => console.error('Error creando gasto:', err),
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
      // Recurrente finito → generar TODAS las cuotas
      dates = generateFiniteInstanceDates(
        payment.frequency, payment.startDate, payment.paymentDay, payment.installments
      );
      amount = Math.round((payment.totalAmount / payment.installments) * 100) / 100;
    } else {
      // Recurrente indefinido → generar 60 períodos (5 años)
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
