import { Component, input, output } from '@angular/core';

export interface BadgeOption {
  id: string;
  label: string;
  color?: string;
}

@Component({
  selector: 'app-badge',
  templateUrl: './badge.component.html',
  styleUrls: ['./badge.component.css'],
})
export class BadgeComponent {
  // --------------- Inputs --------------- //
  /** Texto a mostrar dentro del badge */
  label = input.required<string>();
  /** Color de DaisyUI: 'success' | 'warning' | 'error' | 'info' | 'primary' | 'ghost' */
  color = input<string>('ghost');
  /** Si se proporcionan, el badge actúa como un dropdown */
  options = input<BadgeOption[]>([]);

  // --------------- Outputs --------------- //
  optionSelected = output<string>();

  // --------------- Getters --------------- //
  get isInteractive(): boolean {
    return this.options().length > 0;
  }

  // --------------- Methods --------------- //
  onOptionClick(option: BadgeOption): void {
    this.optionSelected.emit(option.id);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }
}
