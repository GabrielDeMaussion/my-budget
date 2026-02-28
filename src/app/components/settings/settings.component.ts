import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { PaymentService } from '../../services/payment.service';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../services/dialog.service';
import { PaymentCategory } from '../../interfaces/payment-category.interface';
import { DatabaseService } from '../../services/database.service';

interface CategoryGroup {
  parent: PaymentCategory;
  children: PaymentCategory[];
}

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
  private readonly databaseService = inject(DatabaseService);

  // --------------- Constants --------------- //
  readonly themes = [
    'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate',
    'synthwave', 'retro', 'cyberpunk', 'valentine', 'halloween',
    'garden', 'forest', 'aqua', 'lofi', 'pastel', 'fantasy',
    'wireframe', 'black', 'luxury', 'dracula', 'cmyk', 'autumn',
    'business', 'acid', 'limelight', 'night', 'coffee', 'winter',
    'dim', 'nord', 'sunset', 'caramellatte', 'abyss', 'silk',
  ];

  // --------------- State --------------- //
  categories = signal<PaymentCategory[]>([]);
  isLoading = signal(true);

  currentTheme = signal(localStorage.getItem('app-theme') || 'dark');
  newCategoryName = '';
  newSubcategoryName: { [parentId: number]: string } = {};
  editingCategoryId = signal<number | string | null>(null);
  editingCategoryValue = '';
  /** Controla qué categoría padre tiene el formulario de subcategoría abierto */
  addingSubcategoryTo = signal<number | null>(null);
  /** Controla qué categorías padre están expandidas */
  expandedCategories = signal<Set<number>>(new Set());

  /** Categorías agrupadas: raíces con sus hijas */
  groupedCategories = computed<CategoryGroup[]>(() => {
    const cats = this.categories();
    const roots = cats.filter((c) => !c.parentId);
    return roots.map((parent) => ({
      parent,
      children: cats.filter((c) => c.parentId === parent.id),
    }));
  });

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

    this.paymentService.createPaymentCategory({ value: name, parentId: null }).subscribe({
      next: () => {
        this.newCategoryName = '';
        this.loadCategories();
      },
      error: (err) => console.error('Error creando categoría:', err),
    });
  }

  toggleExpand(parentId: number): void {
    this.expandedCategories.update((set) => {
      const newSet = new Set(set);
      if (newSet.has(parentId)) {
        newSet.delete(parentId);
      } else {
        newSet.add(parentId);
      }
      return newSet;
    });
  }

  isExpanded(parentId: number): boolean {
    return this.expandedCategories().has(parentId);
  }

  toggleAddSubcategory(parentId: number): void {
    if (this.addingSubcategoryTo() === parentId) {
      this.addingSubcategoryTo.set(null);
    } else {
      // Expand the category when adding subcategory
      this.expandedCategories.update((set) => {
        const newSet = new Set(set);
        newSet.add(parentId);
        return newSet;
      });
      this.addingSubcategoryTo.set(parentId);
      this.newSubcategoryName[parentId] = '';
    }
  }

  addSubcategory(parentId: number): void {
    const name = (this.newSubcategoryName[parentId] || '').trim();
    if (!name) return;

    this.paymentService.createPaymentCategory({ value: name, parentId }).subscribe({
      next: () => {
        this.newSubcategoryName[parentId] = '';
        this.addingSubcategoryTo.set(null);
        this.loadCategories();
      },
      error: (err) => console.error('Error creando subcategoría:', err),
    });
  }

  startEdit(cat: PaymentCategory): void {
    this.editingCategoryId.set(cat.id!);
    this.editingCategoryValue = cat.value;
  }

  cancelEdit(): void {
    this.editingCategoryId.set(null);
    this.editingCategoryValue = '';
  }

  saveEdit(cat: PaymentCategory): void {
    const value = this.editingCategoryValue.trim();
    if (!value) return;

    this.paymentService.updatePaymentCategory(cat.id!, { value }).subscribe({
      next: () => {
        this.editingCategoryId.set(null);
        this.editingCategoryValue = '';
        this.loadCategories();
      },
      error: (err) => console.error('Error actualizando categoría:', err),
    });
  }

  deleteCategory(cat: PaymentCategory): void {
    const isParent = !cat.parentId;
    const children = isParent
      ? this.categories().filter((c) => c.parentId === cat.id)
      : [];
    const msg = isParent && children.length > 0
      ? `¿Estás seguro de eliminar "${cat.value}" y sus ${children.length} subcategoría(s)?`
      : `¿Estás seguro de eliminar "${cat.value}"?`;

    this.dialogService
      .confirm('Eliminar categoría', msg, 'error')
      .subscribe((confirmed) => {
        if (confirmed) {
          // Eliminar subcategorías primero si es una categoría padre
          const childDeletes = children.map((c) =>
            firstValueFrom(this.paymentService.deletePaymentCategory(c.id!))
          );
          Promise.all(childDeletes).then(() => {
            this.paymentService.deletePaymentCategory(cat.id!).subscribe({
              next: () => this.loadCategories(),
              error: (err) => console.error('Error eliminando categoría:', err),
            });
          });
        }
      });
  }

  // --- Backup & Restore ---
  async exportDatabase(): Promise<void> {
    try {
      this.isLoading.set(true);
      const json = await this.databaseService.exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my_budget_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error exportando base de datos:', e);
    } finally {
      this.isLoading.set(false);
    }
  }

  triggerFileInput(): void {
    const fileInput = document.getElementById('backupFileInput') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  async importDatabase(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const reader = new FileReader();

    this.isLoading.set(true);
    reader.onload = async (e) => {
      try {
        const json = e.target?.result as string;
        await this.databaseService.restoreBackup(json);
        this.dialogService.alert('Restauración completa', 'La base de datos ha sido restaurada con éxito.', 'success');
        this.loadCategories();
      } catch (err) {
        console.error('Error importando base de datos', err);
        this.dialogService.alert('Error de Restauración', 'El archivo provisto no es válido o está corrupto.', 'error');
      } finally {
        this.isLoading.set(false);
        input.value = ''; // Reset the input
      }
    };
    reader.readAsText(file);
  }
}
