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
import { getCategoryDisplayName } from '../../utils/category.util';

@Component({
    selector: 'app-payment-plans',
    imports: [
        CommonModule,
        FormsModule,
        DataTableComponent,
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

    /** Monto total ya pagado de las instancias del plan seleccionado */
    paidTotal = computed(() => {
        return this.workingInstances()
            .filter((i) => i.state === PaymentInstanceState.PAID)
            .reduce((sum, i) => sum + (i.amount || 0), 0);
    });

    /** Monto restante por pagar */
    remainingTotal = computed(() => {
        const payment = this.selectedPayment();
        if (!payment) return 0;
        return +(payment.totalAmount - this.paidTotal()).toFixed(2);
    });

    /** Cantidad de instancias no pagadas */
    unpaidCount = computed(() => {
        return this.workingInstances().filter((i) => i.state !== PaymentInstanceState.PAID).length;
    });

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
                const catName = getCategoryDisplayName(p.paymentCategoryId, this.categories());
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
            const planInstances = instances.filter((i) => i.paymentId === p.id);
            const paidInstances = planInstances.filter((i) => i.state === PaymentInstanceState.PAID);
            const typeName = p.paymentTypeId === this.INCOME_TYPE_ID ? 'Ingreso' : 'Gasto';
            const typeColor = p.paymentTypeId === this.INCOME_TYPE_ID ? 'success' : 'error';

            return {
                id: p.id,
                comments: p.comments || '—',
                categoryName: getCategoryDisplayName(p.paymentCategoryId, this.categories()),
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
        { id: 'activate', label: 'Activar plan', icon: 'bi-play-circle' },
        { id: 'complete', label: 'Completar plan', icon: 'bi-check-circle' },
        { id: 'cancel', label: 'Cancelar plan', icon: 'bi-x-circle' },
        { id: 'delete', label: 'Eliminar plan', icon: 'bi-trash' },
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

                // Auto-complete: check plans where all instances are PAID
                this.autoCompletePlans(data.payments, data.instances);
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
        const payment = event.item._payment;
        switch (event.actionId) {
            case 'detail':
                this.openPlanDetail(payment);
                break;
            case 'activate':
                this.changePlanState(payment, PaymentState.ACTIVE);
                break;
            case 'complete':
                this.changePlanState(payment, PaymentState.COMPLETED);
                break;
            case 'cancel':
                this.changePlanState(payment, PaymentState.CANCELLED);
                break;
            case 'delete':
                this.deletePlan(payment);
                break;
        }
    }

    openPlanDetail(payment: Payment): void {
        const instances = this.allInstances().filter((i) => i.paymentId === payment.id).sort((a, b) => a.installmentNumber - b.installmentNumber);

        this.selectedPayment.set(payment);
        this.selectedInstances.set(instances);
        this.workingInstances.set(instances.map(inst => ({ ...inst })));
        this.selectedCategoryName.set(getCategoryDisplayName(payment.paymentCategoryId, this.categories()));

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
            amount: 0, // Will be recalculated
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

    /**
     * Recalcula montos solo para instancias NO pagadas.
     * Las instancias PAID se mantienen intactas.
     * El monto restante (total - pagado) se distribuye entre las no-pagadas.
     */
    private recalculateAmountsIfFinite(arr: any[]): void {
        const payment = this.selectedPayment();
        // Solo para planes con límite de cuotas (finitos)
        if (!payment || (!payment.frequency || !payment.installments)) return;

        const total = payment.totalAmount || 0;
        const paidSum = arr
            .filter((i) => i.state === PaymentInstanceState.PAID)
            .reduce((sum, i) => sum + (i.amount || 0), 0);
        const remaining = +(total - paidSum).toFixed(2);
        const unpaid = arr.filter((i) => i.state !== PaymentInstanceState.PAID);
        const unpaidCount = unpaid.length;

        if (unpaidCount > 0) {
            const perInstance = +(remaining / unpaidCount).toFixed(2);
            let distributed = 0;
            unpaid.forEach((inst, i) => {
                if (i === unpaid.length - 1) {
                    // Last unpaid gets the remainder to avoid rounding loss
                    inst.amount = +(remaining - distributed).toFixed(2);
                } else {
                    inst.amount = perInstance;
                    distributed += perInstance;
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

        // Determine updates to the payment plan
        const paymentUpdates: Record<string, any> = {};
        if (payment.frequency && payment.installments && current.length !== original.length) {
            paymentUpdates['installments'] = current.length;
        }

        // Auto-complete: if all instances are PAID, mark plan as COMPLETED
        const allPaid = current.length > 0 && current.every(i => i.state === PaymentInstanceState.PAID);
        if (allPaid && payment.state !== PaymentState.COMPLETED) {
            paymentUpdates['state'] = PaymentState.COMPLETED;
        } else if (!allPaid && payment.state === PaymentState.COMPLETED) {
            // If plan was COMPLETED but now not all are paid, revert to ACTIVE
            paymentUpdates['state'] = PaymentState.ACTIVE;
        }

        const updatePaymentTask$: import('rxjs').Observable<any> = Object.keys(paymentUpdates).length > 0
            ? this.paymentService.updatePayment(payment.id!, paymentUpdates)
            : of(null);

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

    // --------------- Delete Plan --------------- //
    /**
     * Elimina un plan de pago completo junto con todas sus instancias.
     */
    deletePlan(payment: Payment): void {
        const instances = this.allInstances().filter((i) => i.paymentId === payment.id);
        const instanceCount = instances.length;
        const description = payment.comments || 'Sin descripción';

        this.dialogService
            .confirm(
                'Eliminar plan de pago',
                `¿Estás seguro de eliminar el plan "${description}"? Se eliminarán ${instanceCount} instancia${instanceCount !== 1 ? 's' : ''} asociada${instanceCount !== 1 ? 's' : ''}. Esta acción no se puede deshacer.`,
                'warning'
            )
            .subscribe((confirmed) => {
                if (!confirmed) return;

                this.isLoading.set(true);

                // First delete all instances, then the payment itself
                const deleteInstances$ = instances.length > 0
                    ? from(instances).pipe(
                        concatMap((inst) => this.paymentService.deletePaymentInstanceById(inst.id!)),
                        toArray()
                    )
                    : of([]);

                deleteInstances$.pipe(
                    switchMap(() => this.paymentService.deletePayment(payment.id!))
                ).subscribe({
                    next: () => this.loadData(),
                    error: (err) => {
                        console.error('Error eliminando plan:', err);
                        this.isLoading.set(false);
                    },
                });
            });
    }

    // --------------- Change Plan State --------------- //
    /**
     * Changes the state of a payment plan and cascades to all its instances.
     * State mapping: ACTIVE → PENDING, PAUSED → PENDING, CANCELLED → CANCELLED, COMPLETED → PAID
     */
    changePlanState(payment: Payment, newState: string): void {
        const stateLabel = getPaymentStateLabel(newState);
        const description = payment.comments || 'Sin descripción';
        const instances = this.allInstances().filter((i) => i.paymentId === payment.id);
        const today = new Date().toISOString().split('T')[0];

        this.dialogService
            .confirm(
                `Cambiar estado del plan`,
                `¿Cambiar el plan "${description}" a "${stateLabel}"? Se actualizarán ${instances.length} instancia${instances.length !== 1 ? 's' : ''} al estado correspondiente.`,
                'info'
            )
            .subscribe((confirmed) => {
                if (!confirmed) return;

                this.isLoading.set(true);

                // Update all instances state based on plan state
                const updateInstances$ = instances.length > 0
                    ? from(instances).pipe(
                        concatMap((inst) => {
                            let instanceState: string;
                            if (newState === PaymentState.ACTIVE) {
                                // Past/current → PAID, future → PENDING
                                instanceState = inst.paymentDate <= today
                                    ? PaymentInstanceState.PAID
                                    : PaymentInstanceState.PENDING;
                            } else if (newState === PaymentState.CANCELLED) {
                                instanceState = PaymentInstanceState.CANCELLED;
                            } else {
                                // COMPLETED → all PAID
                                instanceState = PaymentInstanceState.PAID;
                            }
                            return this.paymentService.updatePaymentInstance(inst.id!, { state: instanceState });
                        }),
                        toArray()
                    )
                    : of([]);

                // Update the plan state
                updateInstances$.pipe(
                    switchMap(() => this.paymentService.updatePayment(payment.id!, { state: newState }))
                ).subscribe({
                    next: () => this.loadData(),
                    error: (err) => {
                        console.error('Error cambiando estado:', err);
                        this.isLoading.set(false);
                    },
                });
            });
    }

    // --------------- Auto-complete Plans --------------- //
    /**
     * Checks all plans and auto-marks as COMPLETED if all instances are PAID.
     * Also reverts COMPLETED plans if not all instances are PAID.
     */
    private autoCompletePlans(payments: Payment[], instances: PaymentInstance[]): void {
        const plansToUpdate: { id: number; state: string }[] = [];

        for (const payment of payments) {
            // Only check recurrent plans with installments
            if (!payment.frequency || payment.frequency === PaymentFrequency.ONCE) continue;

            const planInstances = instances.filter((i) => i.paymentId === payment.id);
            if (planInstances.length === 0) continue;

            const allPaid = planInstances.every((i) => i.state === PaymentInstanceState.PAID);

            if (allPaid && payment.state !== PaymentState.COMPLETED) {
                plansToUpdate.push({ id: payment.id!, state: PaymentState.COMPLETED });
            }
        }

        if (plansToUpdate.length > 0) {
            from(plansToUpdate).pipe(
                concatMap((p) => this.paymentService.updatePayment(p.id, { state: p.state })),
                toArray()
            ).subscribe(() => {
                // Reload payments to reflect the auto-complete state
                const user = this.authService.authUser();
                if (user) {
                    this.paymentService.getPaymentsByUser(user.sub).subscribe((updatedPayments) => {
                        this.payments.set(updatedPayments);
                    });
                }
            });
        }
    }
}
