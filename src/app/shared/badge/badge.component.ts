import { Component, input, output, signal, HostListener, OnDestroy, ElementRef, inject } from '@angular/core';

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

  // --------------- State --------------- //
  isOpen = signal(false);
  dropdownTop = signal(0);
  dropdownLeft = signal(0);

  // --------------- Lifecycle --------------- //
  constructor() {
    window.addEventListener('scroll', this.scrollListener, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.scrollListener, true);
  }

  private scrollListener = (event: Event): void => {
    if (this.isOpen()) {
      this.isOpen.set(false);
    }
  }

  // --------------- Methods --------------- //
  toggleDropdown(event: MouseEvent): void {
    if (!this.isInteractive) return;
    event.stopPropagation();

    if (this.isOpen()) {
      this.isOpen.set(false);
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const dropdownWidth = 160; // w-40 es 10rem = 160px
    let left = rect.right - dropdownWidth;
    if (left < 10) left = 10;

    this.dropdownTop.set(rect.bottom + 4);
    this.dropdownLeft.set(left);
    this.isOpen.set(true);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
    }
  }

  onOptionClick(option: BadgeOption, event: MouseEvent): void {
    event.stopPropagation();
    this.optionSelected.emit(option.id);
    this.isOpen.set(false);
  }
}
