import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PaymentService } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../services/dialog.service';
import { PaymentCategory } from '../../interfaces/payment-category.interface';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
})
export class SettingsComponent implements OnInit {
  // --------------- Injects --------------- //
  private readonly paymentService = inject(PaymentService);
  private readonly authService = inject(AuthService);
  private readonly dialogService = inject(DialogService);

  // --------------- Constants --------------- //
  readonly themes = [
    'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate',
    'synthwave', 'retro', 'cyberpunk', 'valentine', 'halloween',
    'garden', 'forest', 'aqua', 'lofi', 'pastel', 'fantasy',
    'wireframe', 'black', 'luxury', 'dracula', 'cmyk', 'autumn',
    'business', 'acid', 'limelight', 'night', 'coffee', 'winter',
    'dim', 'nord', 'sunset',
  ];

  // --------------- State --------------- //
  categories = signal<PaymentCategory[]>([]);
  isLoading = signal(true);

  currentTheme = signal(localStorage.getItem('app-theme') || 'dark');
  newCategoryName = '';
  editingCategoryId = signal<number | string | null>(null);
  editingCategoryValue = '';

  // --------------- Init --------------- //
  ngOnInit(): void {
    this.loadCategories();
  }

  // --------------- Methods --------------- //
  loadCategories(): void {
    this.isLoading.set(true);
    this.paymentService.getPaymentCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando categorías:', err);
        this.isLoading.set(false);
      },
    });
  }

  // --- Theme ---
  onThemeChange(theme: string): void {
    this.currentTheme.set(theme);
    localStorage.setItem('app-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.authService.updateUserSettings({ theme } as any).subscribe();
  }

  // --- Categories CRUD ---
  addCategory(): void {
    const name = this.newCategoryName.trim();
    if (!name) return;

    this.paymentService.createPaymentCategory({ value: name }).subscribe({
      next: () => {
        this.newCategoryName = '';
        this.loadCategories();
      },
      error: (err) => console.error('Error creando categoría:', err),
    });
  }

  startEdit(cat: PaymentCategory): void {
    this.editingCategoryId.set(cat.id);
    this.editingCategoryValue = cat.value;
  }

  cancelEdit(): void {
    this.editingCategoryId.set(null);
    this.editingCategoryValue = '';
  }

  saveEdit(cat: PaymentCategory): void {
    const value = this.editingCategoryValue.trim();
    if (!value) return;

    this.paymentService.updatePaymentCategory(cat.id, { value }).subscribe({
      next: () => {
        this.editingCategoryId.set(null);
        this.editingCategoryValue = '';
        this.loadCategories();
      },
      error: (err) => console.error('Error actualizando categoría:', err),
    });
  }

  deleteCategory(cat: PaymentCategory): void {
    this.dialogService
      .confirm('Eliminar categoría', `¿Estás seguro de eliminar "${cat.value}"?`, 'error')
      .subscribe((confirmed) => {
        if (confirmed) {
          this.paymentService.deletePaymentCategory(cat.id).subscribe({
            next: () => this.loadCategories(),
            error: (err) => console.error('Error eliminando categoría:', err),
          });
        }
      });
  }
}
