import { Component, input, output, signal, HostListener, OnDestroy } from '@angular/core';

/**
 * Interfaz para los items del menú desplegable genérico.
 */
export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
}

// Global tracker: only one menu open at a time
let activeMenuInstance: MenuComponent | null = null;

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
})
export class MenuComponent implements OnDestroy {
  // --------------- Inputs --------------- //
  menuTitle = input<string>('');
  icon = input<string>('');
  items = input<MenuItem[]>([]);

  // --------------- Outputs --------------- //
  itemClicked = output<string>();

  // --------------- State --------------- //
  isOpen = signal(false);
  menuTop = signal(0);
  menuLeft = signal(0);

  // --------------- Lifecycle --------------- //
  constructor() {
    window.addEventListener('scroll', this.scrollListener, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('scroll', this.scrollListener, true);
    if (activeMenuInstance === this) {
      activeMenuInstance = null;
    }
  }

  private scrollListener = (): void => {
    if (this.isOpen()) {
      this.isOpen.set(false);
      if (activeMenuInstance === this) activeMenuInstance = null;
    }
  }

  // --------------- Methods --------------- //
  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();

    if (this.isOpen()) {
      this.isOpen.set(false);
      activeMenuInstance = null;
      return;
    }

    // Close any other open menu first
    if (activeMenuInstance && activeMenuInstance !== this) {
      activeMenuInstance.isOpen.set(false);
    }
    activeMenuInstance = this;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 208; // w-52 = 13rem = 208px
    const menuHeight = this.items().length * 44 + 24; // approx height per item + padding

    let left = rect.right - menuWidth;
    if (left < 10) left = 10;

    // Check if menu would overflow bottom of viewport → open upward
    const viewportHeight = window.innerHeight;
    let top: number;
    if (rect.bottom + menuHeight + 8 > viewportHeight) {
      // Open upward
      top = rect.top - menuHeight - 4;
      if (top < 10) top = 10;
    } else {
      // Open downward
      top = rect.bottom + 4;
    }

    this.menuTop.set(top);
    this.menuLeft.set(left);
    this.isOpen.set(true);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
      if (activeMenuInstance === this) activeMenuInstance = null;
    }
  }

  onItemClicked(item: MenuItem, event: MouseEvent): void {
    event.stopPropagation();
    this.itemClicked.emit(item.id);
    this.isOpen.set(false);
    activeMenuInstance = null;
  }
}
