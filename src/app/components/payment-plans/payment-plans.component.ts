import { Component, computed, inject, OnInit, signal, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, switchMap, of, from, concatMap, toArray, tap } from 'rxjs';

import { DialogService } from '../../services/dialog.service';
import { AuthService } from '../../services/auth.service';
import { PaymentInstance } from '../../interfaces/payment-instance.interface';
import { Payment } from '../../interfaces/payment.interface';
import { PaymentCategory } from '../../interfaces/payment-category.interface';
import { DataTableComponent, TableColumn } from '../../shared/data-table/data-table.component';
import { MenuItem } from '../../shared/menu/menu.component';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { PaymentDetailComponent } from '../payment-detail/payment-detail.component';

import { PaymentService } from '../../services/payment.service';
import { PaymentInstanceState, getInstanceStateLabel, getInstanceStateColor } from '../../interfaces/enums/payment-instance-state.enum';
import { PaymentFrequency, getFrequencyLabel } from '../../interfaces/enums/payment-frequency.enum';
import { PaymentState, getPaymentStateLabel, getPaymentStateColor } from '../../interfaces/enums/payment-state.enum';
import { generateFiniteInstanceDates, generateIndefiniteInstanceDatesFor5Years } from '../../utils/installment.util';

@Component({
    selector: 'app-payment-plans',
    imports: [
        CommonModule,
        FormsModule,
        DataTableComponent,
        BadgeComponent,
        PaymentDetailComponent,
    ],
    templateUrl: './payment-plans.component.html',
    styleUrls: ['./payment-plans.component.css'],
})
export class PaymentPlansComponent implements OnInit {
    // --------------- Injects --------------- //
    private readonly paymentService = inject(PaymentService);
    private readonly dialogService = inject(DialogService);
    private readonly authService = inject(AuthService);

    // --------------- ViewChild --------------- //
    @ViewChild('planDetailTemplate') planDetailTemplate!: TemplateRef<any>;
    @ViewChild('editFormTemplate') editFormTemplate!: TemplateRef<any>;

    // --------------- Constants --------------- //
    readonly INCOME_TYPE_ID = 1;
    readonly EXPENSE_TYPE_ID = 2;

    // --------------- Signals --------------- //
    isLoading = signal(true);
    payments = signal<Payment[]>([]);
    allInstances = signal<PaymentInstance[]>([]);
    categories = signal<PaymentCategory[]>([]);

    // Filtros
    searchQuery = signal('');
    selectedTypeFilter = signal<'all' | 'income' | 'expense'>('all');
    selectedStateFilter = signal<string>('');
    sortDirection = signal<'asc' | 'desc'>('desc');

    // Detail state
    selectedPayment = signal<Payment | null>(null);
    selectedInstances = signal<PaymentInstance[]>([]);
    workingInstances = signal<any[]>([]); // Copy for batch editing
    selectedCategoryName = signal('—');

    // Edit state (para instancias dentro del detalle)
    editingInstance = signal<any>(null);

    // --------------- Computeds --------------- //
    /** Planes filtrados: solo recurrentes CON cuotas finitas (excluye indefinidos) */
    filteredPlans = computed(() => {
        let plans = this.payments().filter(
            (p) => !!p.frequency && p.frequency !== PaymentFrequency.ONCE && !!p.installments
        );

        // Filtro por tipo (ingreso/egreso)
        const typeFilter = this.selectedTypeFilter();
        if (typeFilter === 'income') {
            plans = plans.filter((p) => p.paymentTypeId === this.INCOME_TYPE_ID);
        } else if (typeFilter === 'expense') {
            plans = plans.filter((p) => p.paymentTypeId === this.EXPENSE_TYPE_ID);
        }

        // Filtro por estado
        const stateFilter = this.selectedStateFilter();
        if (stateFilter) {
            plans = plans.filter((p) => p.state === stateFilter);
        }

        // Búsqueda
        const query = this.searchQuery().toLowerCase().trim();
        if (query) {
            plans = plans.filter((p) => {
                const cat = this.categories().find((c) => c.id === p.paymentCategoryId);
                const catName = cat?.value ?? '';
                return (
                    (p.comments?.toLowerCase().includes(query) ?? false) ||
                    catName.toLowerCase().includes(query) ||
                    getFrequencyLabel(p.frequency).toLowerCase().includes(query)
                );
            });
        }

        return plans;
    });

    /** Datos de la tabla de planes */
    tableData = computed(() => {
        const plans = this.filteredPlans();
        const instances = this.allInstances();

        let data = plans.map((p) => {
            const cat = this.categories().find((c) => c.id === p.paymentCategoryId);
            const planInstances = instances.filter((i) => i.paymentId === p.id);
            const paidInstances = planInstances.filter((i) => i.state === PaymentInstanceState.PAID);
            const typeName = p.paymentTypeId === this.INCOME_TYPE_ID ? 'Ingreso' : 'Gasto';
            const typeColor = p.paymentTypeId === this.INCOME_TYPE_ID ? 'success' : 'error';

            return {
                id: p.id,
                comments: p.comments || '—',
                categoryName: cat?.value ?? '—',
                totalAmount: p.totalAmount,
                frequency: getFrequencyLabel(p.frequency),
                installments: `${paidInstances.length}/${p.installments}`,
                stateLabel: getPaymentStateLabel(p.state),
                stateColor: getPaymentStateColor(p.state),
                typeName,
                typeColor,
                startDate: p.startDate,
                paymentTypeId: p.paymentTypeId,
                _payment: p,
            };
        });

        // Ordenar por fecha inicio
        const dir = this.sortDirection();
        data.sort((a, b) => {
            const cmp = a.startDate.localeCompare(b.startDate);
            return dir === 'desc' ? -cmp : cmp;
        });

        return data;
    });

    totalPlans = computed(() => this.filteredPlans().length);

    /** Columnas de la tabla de planes */
    readonly planColumns: TableColumn[] = [
        { key: 'typeName', label: 'Tipo', type: 'badge', badgeColorKey: 'typeColor', align: 'center' },
        { key: 'comments', label: 'Descripción', align: 'left' },
        { key: 'categoryName', label: 'Categoría', align: 'left' },
        { key: 'totalAmount', label: 'Monto', type: 'currency', align: 'right' },
        { key: 'frequency', label: 'Frecuencia', align: 'left' },
        { key: 'installments', label: 'Cuotas Pagas', align: 'center' },
        { key: 'startDate', label: 'Inicio', type: 'date', align: 'center' },
        { key: 'stateLabel', label: 'Estado', type: 'badge', badgeColorKey: 'stateColor', align: 'center' },
    ];

    /** Acciones de la tabla de planes */
    readonly planActions: MenuItem[] = [
        { id: 'detail', label: 'Ver detalle', icon: 'bi-eye' },
    ];


    // --------------- Lifecycle --------------- //
    ngOnInit(): void {
        this.loadData();
    }

    // --------------- Data Loading --------------- //
    loadData(): void {
        this.isLoading.set(true);
        const user = this.authService.authUser();
        if (!user) return;

        forkJoin({
            payments: this.paymentService.getPaymentsByUser(user.sub),
            instances: this.paymentService.getPaymentInstances(),
            categories: this.paymentService.getPaymentCategories(),
        }).subscribe({
            next: (data) => {
                this.payments.set(data.payments);
                this.allInstances.set(data.instances);
                this.categories.set(data.categories);
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error('Error cargando planes de pago:', err);
                this.isLoading.set(false);
            },
        });
    }

    // --------------- Filter Methods --------------- //
    onSearchChange(query: string): void {
        this.searchQuery.set(query);
    }

    onTypeFilterChange(type: string): void {
        this.selectedTypeFilter.set(type as 'all' | 'income' | 'expense');
    }

    onStateFilterChange(state: string): void {
        this.selectedStateFilter.set(state);
    }

    toggleSort(): void {
        this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    }

    // --------------- Plan Table Actions --------------- //
    onPlanAction(event: { actionId: string; item: any }): void {
        if (event.actionId === 'detail') {
            this.openPlanDetail(event.item._payment);
        }
    }

    openPlanDetail(payment: Payment): void {
        const instances = this.allInstances().filter((i) => i.paymentId === payment.id).sort((a, b) => a.installmentNumber - b.installmentNumber);
        const category = this.categories().find((c) => c.id === payment.paymentCategoryId);

        this.selectedPayment.set(payment);
        this.selectedInstances.set(instances);
        this.workingInstances.set(instances.map(inst => ({ ...inst })));
        this.selectedCategoryName.set(category?.value ?? '—');

        this.dialogService.open({
            type: 'custom',
            title: 'Detalle del plan de pago',
            templateRef: this.planDetailTemplate,
            wide: true,
            // Sin confirmText, para evitar los botones por defecto y dibujar el nuestro propio Guardar
        });
    }

    // --------------- Batch Instance Management --------------- //

    onAddInstance(): void {
        const payment = this.selectedPayment();
        if (!payment) return;

        const current = this.workingInstances();
        const existingInstances = [...current].sort((a, b) => a.paymentDate.localeCompare(b.paymentDate));
        const lastInstance = existingInstances.length > 0 ? existingInstances[existingInstances.length - 1] : null;

        let nextDate: string;
        if (lastInstance) {
            const parts = lastInstance.paymentDate.split('-');
            const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            d.setMonth(d.getMonth() + 1);
            nextDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        } else {
            nextDate = payment.startDate;
        }

        const newInstance = {
            paymentId: payment.id!,
            amount: payment.totalAmount,
            paymentDate: nextDate,
            installmentNumber: current.length + 1,
            state: PaymentInstanceState.PENDING,
            comments: payment.comments || '',
        };

        this.workingInstances.update(arr => {
            const newArr = [...arr, newInstance];
            this.recalculateAmountsIfFinite(newArr);
            return newArr;
        });
    }

    removeWorkingInstance(index: number): void {
        const payment = this.selectedPayment();
        const isIndefinite = payment?.frequency && !payment?.installments;

        this.workingInstances.update(arr => {
            const newArr = [...arr];
            if (isIndefinite) {
                const inst = newArr[index];
                if (window.confirm('¿Borrar este registro y TODOS los futuros correspondientes a esta serie?')) {
                    return newArr.filter(i => i.paymentDate < inst.paymentDate);
                }
                return newArr;
            } else {
                newArr.splice(index, 1);
                newArr.forEach((item, i) => item.installmentNumber = i + 1);
                this.recalculateAmountsIfFinite(newArr);
                return newArr;
            }
        });
    }

    private recalculateAmountsIfFinite(arr: any[]): void {
        const payment = this.selectedPayment();
        // Solo para planes con límite de cuotas (finitos)
        if (!payment || (!payment.frequency || !payment.installments)) return;

        const total = payment.totalAmount || 0;
        const count = arr.length;
        if (count > 0) {
            const perInstance = +(total / count).toFixed(2);
            arr.forEach((inst, i) => {
                // Asignar el resto exacto a la última cuota para evitar pérdida por redondeo
                if (i === arr.length - 1) {
                    inst.amount = +(total - (perInstance * (count - 1))).toFixed(2);
                } else {
                    inst.amount = perInstance;
                }
            });
        }
    }

    saveBatch(): void {
        const payment = this.selectedPayment();
        if (!payment) return;

        this.isLoading.set(true);
        const original = this.selectedInstances();
        const current = this.workingInstances();
        const tasks: any[] = [];

        const currentIds = current.map(c => c.id).filter(id => id != null);
        for (const orig of original) {
            if (orig.id && !currentIds.includes(orig.id)) {
                tasks.push(this.paymentService.deletePaymentInstanceById(orig.id));
            }
        }

        for (const inst of current) {
            if (!inst.id) {
                tasks.push(this.paymentService.createPaymentInstance({
                    paymentId: payment.id!,
                    amount: inst.amount,
                    paymentDate: inst.paymentDate,
                    installmentNumber: inst.installmentNumber,
                    state: inst.state,
                    comments: inst.comments || ''
                }));
            } else {
                tasks.push(this.paymentService.updatePaymentInstance(inst.id, {
                    amount: inst.amount,
                    paymentDate: inst.paymentDate,
                    installmentNumber: inst.installmentNumber,
                    state: inst.state,
                    comments: inst.comments
                }));
            }
        }

        let updatePaymentTask$: import('rxjs').Observable<any> = of(null);
        if (payment.frequency && payment.installments && current.length !== original.length) {
            updatePaymentTask$ = this.paymentService.updatePayment(payment.id!, { installments: current.length });
        }

        forkJoin(tasks.length ? tasks : [of(null)]).pipe(
            switchMap(() => updatePaymentTask$)
        ).subscribe({
            next: () => {
                this.dialogService.close();
                this.loadData();
            },
            error: (err) => {
                console.error('Error guardando:', err);
                this.isLoading.set(false);
            }
        });
    }

    cancelBatch(): void {
        this.dialogService.close();
    }

    /**
     * Recarga los datos y reabre el detalle del plan seleccionado.
     */
    private refreshDataAndReopenDetail(): void {
        const paymentId = this.selectedPayment()?.id;
        this.dialogService.close();

        const user = this.authService.authUser();
        if (!user) return;

        forkJoin({
            payments: this.paymentService.getPaymentsByUser(user.sub),
            instances: this.paymentService.getPaymentInstances(),
            categories: this.paymentService.getPaymentCategories(),
        }).subscribe((data) => {
            this.payments.set(data.payments);
            this.allInstances.set(data.instances);
            this.categories.set(data.categories);

            if (paymentId) {
                const updatedPayment = data.payments.find((p) => p.id === paymentId);
                if (updatedPayment) {
                    setTimeout(() => this.openPlanDetail(updatedPayment), 100);
                }
            }
        });
    }
}
