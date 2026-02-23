import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Payment } from '../../interfaces/payment.interface';
import { PaymentInstance } from '../../interfaces/payment-instance.interface';
import { DataTableComponent, TableColumn } from '../../shared/data-table/data-table.component';
import { BadgeComponent } from '../../shared/badge/badge.component';
import { getFrequencyLabel } from '../../interfaces/enums/payment-frequency.enum';
import { getPaymentStateLabel, getPaymentStateColor } from '../../interfaces/enums/payment-state.enum';
import { getInstanceStateLabel, getInstanceStateColor } from '../../interfaces/enums/payment-instance-state.enum';

@Component({
  selector: 'app-payment-detail',
  imports: [CommonModule, DataTableComponent, BadgeComponent],
  templateUrl: './payment-detail.component.html',
  styleUrls: ['./payment-detail.component.css'],
})
export class PaymentDetailComponent {
  // --------------- Inputs --------------- //
  payment = input.required<Payment>();
  instances = input.required<PaymentInstance[]>();
  categoryName = input<string>('—');

  // --------------- Computeds --------------- //
  /** El plan es de tipo único (frequency null) */
  isOnce = computed(() => !this.payment().frequency);

  /** Es recurrente indefinido (sin cantidad de cuotas) */
  isIndefinite = computed(() => !this.isOnce() && !this.payment().installments);

  frequencyLabel = computed(() => getFrequencyLabel(this.payment().frequency));

  planStateLabel = computed(() => getPaymentStateLabel(this.payment().state));
  planStateColor = computed(() => getPaymentStateColor(this.payment().state));

  /** Columnas para la tabla de instancias */
  readonly instanceColumns: TableColumn[] = [
    { key: 'installmentNumber', label: '#' },
    { key: 'paymentDate', label: 'Fecha', type: 'date' },
    { key: 'amount', label: 'Monto', type: 'currency' },
    { key: 'stateLabel', label: 'Estado', type: 'badge', badgeColorKey: 'stateColor' },
    { key: 'comments', label: 'Comentarios' },
  ];

  /** Instancias enriquecidas con labels/colors, ordenadas por # cuota */
  enrichedInstances = computed(() =>
    this.instances()
      .map((inst) => ({
        ...inst,
        stateLabel: getInstanceStateLabel(inst.state),
        stateColor: getInstanceStateColor(inst.state),
      }))
      .sort((a, b) => a.installmentNumber - b.installmentNumber)
  );

  /** Datos de la primera (y única) instancia para pagos únicos */
  singleInstance = computed(() => {
    const list = this.enrichedInstances();
    return list.length > 0 ? list[0] : null;
  });
}
