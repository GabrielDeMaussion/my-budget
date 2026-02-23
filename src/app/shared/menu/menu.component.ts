import { Component, input, output } from '@angular/core';

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

  // --------------- Methods --------------- //
  onItemClicked(item: MenuItem): void {
    this.itemClicked.emit(item.id);
    // Cerrar el dropdown al hacer click
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }
}
