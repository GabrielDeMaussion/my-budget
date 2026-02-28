import { Component, computed, inject, OnInit, signal, ViewChild, ElementRef, AfterViewInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, switchMap, of } from 'rxjs';

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
import { getCategoryDisplayName, getParentCategoryName, getSubcategoryName, getParentCategoryId } from '../../utils/category.util';

export type DetailView = 'table' | 'charts';
export type ChartMetric = 'category' | 'state' | 'type';
export type TrendMetric = 'amount' | 'count';

@Component({
  selector: 'app-summary',
  imports: [CommonModule, FormsModule, DataTableComponent],
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.css'],
})
export class SummaryComponent implements OnInit, AfterViewInit {
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
    { key: 'paymentDate', label: 'Fecha', type: 'date', align: 'center' },
    { key: 'typeName', label: 'Tipo', type: 'badge', badgeColorKey: 'typeColor', align: 'center' },
    { key: 'description', label: 'Descripción', align: 'left' },
    { key: 'categoryName', label: 'Categoría', align: 'left' },
    { key: 'subcategoryName', label: 'Subcategoría', align: 'left' },
    { key: 'amount', label: 'Monto', type: 'currency', align: 'right' },
    { key: 'installmentInfo', label: 'Cuota', type: 'pill', align: 'center' },
    { key: 'stateLabel', label: 'Estado', type: 'badge', badgeColorKey: 'stateColor', align: 'center' },
  ];

  // --------------- Chart View Options --------------- //
  readonly chartMetricOptions: { value: ChartMetric; label: string }[] = [
    { value: 'category', label: 'Por Categoría' },
    { value: 'state', label: 'Por Estado' },
    { value: 'type', label: 'Ingresos vs Gastos' },
  ];

  readonly trendMetricOptions: { value: TrendMetric; label: string }[] = [
    { value: 'amount', label: 'Monto ($)' },
    { value: 'count', label: 'Cant. Movimientos' },
  ];

  readonly CHART_COLORS = [
    '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#3b82f6',
    '#84cc16', '#a855f7', '#ef4444', '#22d3ee', '#e879f9',
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
  selectedCategoryId = signal<number | null>(null);
  selectedSubcategoryId = signal<number | null>(null);
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Detail view toggle
  detailView = signal<DetailView>('table');
  chartMetric = signal<ChartMetric>('category');
  chartTypeFilter = signal<'all' | 'income' | 'expense'>('all');
  chartCategoryFilter = signal<number | null>(null);
  chartSubcategoryFilter = signal<number | null>(null);
  trendMetric = signal<TrendMetric>('amount');
  trendTypeFilter = signal<'all' | 'income' | 'expense'>('all');
  trendCategoryFilter = signal<number | null>(null);
  trendSubcategoryFilter = signal<number | null>(null);

  // Canvas refs
  @ViewChild('donutCanvas') donutCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendCanvas') trendCanvas!: ElementRef<HTMLCanvasElement>;

  private viewInitialized = false;

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
    return this.allInstances().filter(
      (inst) => inst.paymentDate >= start && inst.paymentDate <= end
    );
  });

  tableData = computed(() => {
    const query = this.searchQuery().toLowerCase();
    const typeFilter = this.selectedType();
    const catId = this.selectedCategoryId();
    const subCatId = this.selectedSubcategoryId();
    const direction = this.sortDirection();

    let rows = this.filteredInstances().map((inst) => {
      const payment = this.payments().find((p) => p.id === inst.paymentId);
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
        categoryName: getParentCategoryName(payment?.paymentCategoryId, this.categories()),
        subcategoryName: getSubcategoryName(payment?.paymentCategoryId, this.categories()),
        parentCategoryId: getParentCategoryId(payment?.paymentCategoryId, this.categories()) ?? 0,
        paymentCategoryId: payment?.paymentCategoryId ?? 0,
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
          r.subcategoryName.toLowerCase().includes(query) ||
          r.typeName.toLowerCase().includes(query)
      );
    }
    if (typeFilter) {
      const typeId = typeFilter === 'income' ? this.INCOME_TYPE_ID : this.EXPENSE_TYPE_ID;
      rows = rows.filter((r) => r.paymentTypeId === typeId);
    }
    if (catId) rows = rows.filter((r) => r.parentCategoryId === catId);
    if (subCatId) rows = rows.filter((r) => r.paymentCategoryId === subCatId);

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

  /** Root categories used in the data (for filter dropdown) */
  rootCategories = computed(() => {
    const catIds = new Set(
      this.payments()
        .map((p) => getParentCategoryId(p.paymentCategoryId, this.categories()))
        .filter((id): id is number => id !== undefined)
    );
    return this.categories().filter((c) => !c.parentId && catIds.has(c.id!));
  });

  /** Subcategories filtered by selected parent category */
  filteredSubcategories = computed(() => {
    const parentId = this.selectedCategoryId();
    if (!parentId) return [];
    return this.categories().filter((c) => c.parentId === parentId);
  });

  /** Subcategories for chart filters - filtered by chart category */
  chartFilteredSubcategories = computed(() => {
    const parentId = this.chartCategoryFilter();
    if (!parentId) return [];
    return this.categories().filter((c) => c.parentId === parentId);
  });

  /** Subcategories for trend filters - filtered by trend category */
  trendFilteredSubcategories = computed(() => {
    const parentId = this.trendCategoryFilter();
    if (!parentId) return [];
    return this.categories().filter((c) => c.parentId === parentId);
  });

  // --------------- Chart Data Computeds --------------- //

  /** Data for the donut/pie chart */
  donutData = computed(() => {
    const rows = this.filteredInstances();
    const metric = this.chartMetric();
    const typeFilter = this.chartTypeFilter();
    const catFilter = this.chartCategoryFilter();
    const subCatFilter = this.chartSubcategoryFilter();

    let filtered = rows.map(inst => {
      const payment = this.payments().find(p => p.id === inst.paymentId);
      return {
        ...inst,
        payment,
        categoryName: getParentCategoryName(payment?.paymentCategoryId, this.categories()),
        subcategoryName: getSubcategoryName(payment?.paymentCategoryId, this.categories()),
        parentCategoryId: getParentCategoryId(payment?.paymentCategoryId, this.categories()) ?? 0,
        paymentCategoryId: payment?.paymentCategoryId ?? 0,
        paymentTypeId: payment?.paymentTypeId ?? 0,
      };
    });

    if (typeFilter === 'income') filtered = filtered.filter(r => r.paymentTypeId === this.INCOME_TYPE_ID);
    if (typeFilter === 'expense') filtered = filtered.filter(r => r.paymentTypeId === this.EXPENSE_TYPE_ID);
    if (catFilter) filtered = filtered.filter(r => r.parentCategoryId === catFilter);
    if (subCatFilter) filtered = filtered.filter(r => r.paymentCategoryId === subCatFilter);

    const groups: Record<string, number> = {};

    if (metric === 'category') {
      // If a category is selected but no subcategory, show breakdown by subcategories
      if (catFilter && !subCatFilter) {
        filtered.forEach(r => {
          const label = r.subcategoryName !== '—' ? r.subcategoryName : r.categoryName;
          groups[label] = (groups[label] || 0) + r.amount;
        });
      } else {
        filtered.forEach(r => { groups[r.categoryName] = (groups[r.categoryName] || 0) + r.amount; });
      }
    } else if (metric === 'state') {
      filtered.forEach(r => {
        const label = getInstanceStateLabel(r.state);
        groups[label] = (groups[label] || 0) + r.amount;
      });
    } else {
      filtered.forEach(r => {
        const label = r.paymentTypeId === this.INCOME_TYPE_ID ? 'Ingresos' : 'Gastos';
        groups[label] = (groups[label] || 0) + r.amount;
      });
    }

    return Object.entries(groups)
      .map(([label, value], i) => ({ label, value, color: this.CHART_COLORS[i % this.CHART_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  });

  /** Data for the trend line chart (last 6 months always) */
  trendData = computed(() => {
    const metric = this.trendMetric();
    const typeFilter = this.trendTypeFilter();
    const catFilter = this.trendCategoryFilter();
    const subCatFilter = this.trendSubcategoryFilter();
    const allInstances = this.allInstances();
    const payments = this.payments();
    const categories = this.categories();

    // Generate last 6 months labels
    const months: { label: string; start: string; end: string }[] = [];
    const now = this.referenceDate();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      months.push({ label: `${monthNames[month]} ${year}`, start: startStr, end: endStr });
    }

    const incomeData: number[] = [];
    const expenseData: number[] = [];

    months.forEach(m => {
      let monthInstances = allInstances.filter(inst => inst.paymentDate >= m.start && inst.paymentDate <= m.end);

      let enriched = monthInstances.map(inst => {
        const payment = payments.find(p => p.id === inst.paymentId);
        return {
          ...inst,
          paymentTypeId: payment?.paymentTypeId ?? 0,
          parentCategoryId: getParentCategoryId(payment?.paymentCategoryId, categories) ?? 0,
          paymentCategoryId: payment?.paymentCategoryId ?? 0,
        };
      });

      if (catFilter) enriched = enriched.filter(r => r.parentCategoryId === catFilter);
      if (subCatFilter) enriched = enriched.filter(r => r.paymentCategoryId === subCatFilter);

      const incomeRows = enriched.filter(r => r.paymentTypeId === this.INCOME_TYPE_ID);
      const expenseRows = enriched.filter(r => r.paymentTypeId === this.EXPENSE_TYPE_ID);

      if (metric === 'amount') {
        incomeData.push(incomeRows.reduce((s, r) => s + r.amount, 0));
        expenseData.push(expenseRows.reduce((s, r) => s + r.amount, 0));
      } else {
        incomeData.push(incomeRows.length);
        expenseData.push(expenseRows.length);
      }
    });

    return {
      labels: months.map(m => m.label),
      income: incomeData,
      expense: expenseData,
    };
  });

  constructor() {
    // Effect to re-render charts when data or settings change
    effect(() => {
      // Access signals to trigger effect
      const view = this.detailView();
      const donut = this.donutData();
      const trend = this.trendData();
      const loading = this.isLoading();

      if (view === 'charts' && !loading && this.viewInitialized) {
        // Schedule after DOM update
        setTimeout(() => {
          this.renderDonutChart();
          this.renderTrendChart();
        }, 50);
      }
    });
  }

  // --------------- Init --------------- //
  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;
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

  onCategoryChange(value: string): void {
    this.selectedCategoryId.set(value ? Number(value) : null);
    this.selectedSubcategoryId.set(null); // Reset subcategory when category changes
  }

  onSubcategoryChange(value: string): void {
    this.selectedSubcategoryId.set(value ? Number(value) : null);
  }

  onChartCategoryChange(value: string): void {
    this.chartCategoryFilter.set(value ? Number(value) : null);
    this.chartSubcategoryFilter.set(null);
  }

  onChartSubcategoryChange(value: string): void {
    this.chartSubcategoryFilter.set(value ? Number(value) : null);
  }

  onTrendCategoryChange(value: string): void {
    this.trendCategoryFilter.set(value ? Number(value) : null);
    this.trendSubcategoryFilter.set(null);
  }

  onTrendSubcategoryChange(value: string): void {
    this.trendSubcategoryFilter.set(value ? Number(value) : null);
  }

  toggleSort(): void {
    this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
  }

  onBadgeOptionClicked(event: { column: string; item: any; optionId: string }): void {
    if (event.column === 'stateLabel') {
      this.paymentService
        .updatePaymentInstance(event.item.id!, { state: event.optionId })
        .pipe(
          switchMap(() => {
            const payment = this.payments().find((p) => p.id === event.item.paymentId);
            if (!payment || !payment.frequency) return of(null);

            const planInstances = this.allInstances().filter((i) => i.paymentId === payment.id);
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

  setDetailView(view: DetailView): void {
    this.detailView.set(view);
  }

  // ============================================================
  // Canvas Chart Rendering
  // ============================================================

  private renderDonutChart(): void {
    const canvas = this.donutCanvas?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const data = this.donutData();
    if (data.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No hay datos para mostrar', w / 2, h / 2);
      return;
    }

    const total = data.reduce((s, d) => s + d.value, 0);
    const cx = w * 0.35;
    const cy = h / 2;
    const radius = Math.min(cx, cy) - 20;
    const innerRadius = radius * 0.55;

    let startAngle = -Math.PI / 2;

    data.forEach(slice => {
      const sliceAngle = (slice.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + innerRadius * Math.cos(startAngle), cy + innerRadius * Math.sin(startAngle));
      ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
      ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = slice.color;
      ctx.fill();
      startAngle += sliceAngle;
    });

    // Center text
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('color') || '#e2e8f0';
    ctx.font = 'bold 18px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, cx, cy - 8);
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Total', cx, cy + 12);

    // Legend on the right side
    const legendX = w * 0.65;
    let legendY = Math.max(20, cy - (data.length * 28) / 2);

    data.forEach(slice => {
      const pct = ((slice.value / total) * 100).toFixed(1);

      ctx.fillStyle = slice.color;
      ctx.fillRect(legendX, legendY, 12, 12);

      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('color') || '#e2e8f0';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${slice.label}`, legendX + 18, legendY - 1);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px Inter, sans-serif';
      ctx.fillText(`$${slice.value.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${pct}%)`, legendX + 18, legendY + 13);

      legendY += 32;
    });
  }

  private renderTrendChart(): void {
    const canvas = this.trendCanvas?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const trend = this.trendData();
    const typeFilter = this.trendTypeFilter();
    const labels = trend.labels;
    const datasets: { data: number[]; color: string; label: string }[] = [];

    if (typeFilter === 'all' || typeFilter === 'income') {
      datasets.push({ data: trend.income, color: '#10b981', label: 'Ingresos' });
    }
    if (typeFilter === 'all' || typeFilter === 'expense') {
      datasets.push({ data: trend.expense, color: '#f43f5e', label: 'Gastos' });
    }

    const padding = { top: 30, right: 20, bottom: 50, left: 65 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    // Calculate max value
    let maxVal = 0;
    datasets.forEach(ds => ds.data.forEach(v => { if (v > maxVal) maxVal = v; }));
    if (maxVal === 0) maxVal = 100;
    maxVal = Math.ceil(maxVal * 1.15);

    // Grid lines
    const gridLines = 5;
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + chartH - (i / gridLines) * chartH;
      const val = (i / gridLines) * maxVal;

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();

      const metric = this.trendMetric();
      const formatted = metric === 'amount'
        ? `$${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0)}`
        : val.toFixed(0);
      ctx.fillText(formatted, padding.left - 8, y);
    }

    // X labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    labels.forEach((label, i) => {
      const x = padding.left + (i / (labels.length - 1)) * chartW;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(label, x, padding.top + chartH + 10);
    });

    // Draw lines
    datasets.forEach(ds => {
      ctx.beginPath();
      ctx.strokeStyle = ds.color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ds.data.forEach((val, i) => {
        const x = padding.left + (i / (labels.length - 1)) * chartW;
        const y = padding.top + chartH - (val / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();

      // Gradient fill
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
      gradient.addColorStop(0, ds.color + '40');
      gradient.addColorStop(1, ds.color + '05');

      ctx.beginPath();
      ds.data.forEach((val, i) => {
        const x = padding.left + (i / (labels.length - 1)) * chartW;
        const y = padding.top + chartH - (val / maxVal) * chartH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(padding.left + chartW, padding.top + chartH);
      ctx.lineTo(padding.left, padding.top + chartH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Dots
      ds.data.forEach((val, i) => {
        const x = padding.left + (i / (labels.length - 1)) * chartW;
        const y = padding.top + chartH - (val / maxVal) * chartH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = ds.color;
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });

    // Legend at top
    let legendX = padding.left;
    datasets.forEach(ds => {
      ctx.fillStyle = ds.color;
      ctx.fillRect(legendX, 8, 12, 12);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(ds.label, legendX + 16, 9);
      legendX += ctx.measureText(ds.label).width + 40;
    });
  }
}
