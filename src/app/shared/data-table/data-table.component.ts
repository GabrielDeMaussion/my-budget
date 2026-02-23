import { Component, input, output } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { MenuComponent, MenuItem } from '../menu/menu.component';
import { BadgeComponent, BadgeOption } from '../badge/badge.component';

/**
 * Definición de una columna de la tabla genérica.
 */
export interface TableColumn {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'currency' | 'badge' | 'pill';
  /** (badge) Propiedad del objeto que contiene el color del badge */
  badgeColorKey?: string;
  /** (badge) Color estático del badge */
  badgeColor?: string;
  /** (badge) Si se proporcionan, el badge actúa como un dropdown menu */
  badgeOptions?: BadgeOption[];
}

@Component({
  selector: 'app-data-table',
  imports: [CurrencyPipe, DatePipe, MenuComponent, BadgeComponent],
  templateUrl: './data-table.component.html',
  styleUrls: ['./data-table.component.css'],
})
export class DataTableComponent {
  // --------------- Inputs --------------- //
  columns = input.required<TableColumn[]>();
  data = input.required<any[]>();
  showActions = input<boolean>(false);
  actions = input<MenuItem[]>([]);

  // --------------- Outputs --------------- //
  actionClicked = output<{ actionId: string; item: any }>();
  badgeOptionClicked = output<{ column: string; item: any; optionId: string }>();

  // --------------- Methods --------------- //
  onActionClicked(actionId: string, item: any): void {
    this.actionClicked.emit({ actionId, item });
  }

  onBadgeOptionSelected(columnKey: string, item: any, optionId: string): void {
    this.badgeOptionClicked.emit({ column: columnKey, item, optionId });
  }

  getCellValue(row: any, key: string): any {
    return key.split('.').reduce((obj, k) => obj?.[k], row);
  }
}
