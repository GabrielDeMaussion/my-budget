import { Component, input, output, signal, HostListener, OnDestroy } from '@angular/core';

/**
 * Interfaz para los items del menú desplegable genérico.
 *
 * Atributos:
 * - id: Identificador único del item (emitido al hacer click)
 * - label: Texto visible del item
 * - icon: Clase de Bootstrap Icons (opcional, sin prefijo "bi-")
 */
export interface MenuItem {
  id: string;
  label: string;
  icon?: string;
}

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css'],
})
export class MenuComponent {
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
    // Escucha scrolls en fase de captura para cerrar menús si el contenedor hace scroll
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
  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isOpen()) {
      this.isOpen.set(false);
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const menuWidth = 208; // 52 * 4px = 208px (Clase w-52)
    let left = rect.right - menuWidth;
    if (left < 10) left = 10;

    this.menuTop.set(rect.bottom + 4);
    this.menuLeft.set(left);
    this.isOpen.set(true);
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.isOpen()) {
      this.isOpen.set(false);
    }
  }

  onItemClicked(item: MenuItem, event: MouseEvent): void {
    event.stopPropagation();
    this.itemClicked.emit(item.id);
    this.isOpen.set(false);
  }
}
