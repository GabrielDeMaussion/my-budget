import { Component, computed, HostListener, inject, input, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { PaymentCategory } from '../../interfaces/payment-category.interface';
import { PaymentService } from '../../services/payment.service';
import { firstValueFrom } from 'rxjs';

export interface InstanceEditResult {
    amount: number;
    comments: string;
    paymentCategoryId: number;
}

interface CategoryGroup {
    parent: PaymentCategory;
    children: PaymentCategory[];
}

@Component({
    selector: 'app-instance-edit-form',
    imports: [CommonModule, FormsModule],
    templateUrl: './instance-edit-form.component.html',
    styleUrls: ['./instance-edit-form.component.css'],
})
export class InstanceEditFormComponent implements OnInit {
    // --------------- Injects --------------- //
    private readonly paymentService = inject(PaymentService);

    // --------------- Inputs --------------- //
    initialAmount = input.required<number>();
    initialComments = input.required<string>();
    initialCategoryId = input.required<number>();

    // --------------- Outputs --------------- //
    formSubmit = output<InstanceEditResult>();
    formCancel = output<void>();

    // --------------- State --------------- //
    categories = signal<PaymentCategory[]>([]);

    form = {
        amount: 0,
        comments: '',
        paymentCategoryId: 0,
    };

    private initialized = false;

    // --------------- Category Dropdown --------------- //
    groupedCategories = computed<CategoryGroup[]>(() => {
        const cats = this.categories();
        const roots = cats.filter((c) => !c.parentId);
        return roots.map((parent) => ({
            parent,
            children: cats.filter((c) => c.parentId === parent.id),
        }));
    });

    flatCategoryOptions = computed<{ id: number; label: string; isChild: boolean; parentName: string }[]>(() => {
        const result: { id: number; label: string; isChild: boolean; parentName: string }[] = [];
        for (const group of this.groupedCategories()) {
            result.push({
                id: group.parent.id!,
                label: group.parent.value,
                isChild: false,
                parentName: group.parent.value,
            });
            for (const sub of group.children) {
                result.push({
                    id: sub.id!,
                    label: `${group.parent.value} > ${sub.value}`,
                    isChild: true,
                    parentName: group.parent.value,
                });
            }
        }
        return result;
    });

    categorySearch = signal('');
    categoryDropdownOpen = signal(false);

    filteredCategoryOptions = computed(() => {
        const query = this.categorySearch().toLowerCase().trim();
        const all = this.flatCategoryOptions();
        if (!query) return all;
        return all.filter((opt) => opt.label.toLowerCase().includes(query));
    });

    get selectedCategoryLabel(): string {
        const opt = this.flatCategoryOptions().find((o) => o.id === this.form.paymentCategoryId);
        return opt ? opt.label : 'Seleccionar categoría';
    }

    // --------------- Lifecycle --------------- //
    ngOnChanges(): void {
        if (!this.initialized) {
            this.form.amount = this.initialAmount();
            this.form.comments = this.initialComments();
            this.form.paymentCategoryId = this.initialCategoryId();
            this.initialized = true;
        }
    }

    ngOnInit(): void {
        this.form.amount = this.initialAmount();
        this.form.comments = this.initialComments();
        this.form.paymentCategoryId = this.initialCategoryId();

        this.paymentService.getPaymentCategories().subscribe((cats) => {
            this.categories.set(cats);
        });
    }

    // --------------- Methods --------------- //
    onSubmit(): void {
        if (!this.isValid()) return;
        this.formSubmit.emit({
            amount: this.form.amount,
            comments: this.form.comments,
            paymentCategoryId: this.form.paymentCategoryId,
        });
    }

    onCancel(): void {
        this.formCancel.emit();
    }

    isValid(): boolean {
        return this.form.amount >= 0 && !isNaN(this.form.amount) && this.form.paymentCategoryId > 0;
    }

    // --------------- Category Dropdown Methods --------------- //
    selectCategory(id: number): void {
        this.form.paymentCategoryId = id;
        this.categoryDropdownOpen.set(false);
        this.categorySearch.set('');
    }

    toggleCategoryDropdown(): void {
        const isOpen = this.categoryDropdownOpen();
        this.categoryDropdownOpen.set(!isOpen);
        if (!isOpen) {
            this.categorySearch.set('');
            this.cancelNewCategory();
        }
    }

    onCategorySearchChange(value: string): void {
        this.categorySearch.set(value);
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        if (!target.closest('.category-dropdown-container')) {
            this.categoryDropdownOpen.set(false);
            this.cancelNewCategory();
        }
    }

    // --------------- Inline Category Creation --------------- //
    isCreatingCategory = signal(false);
    newCategoryName = signal('');
    newCategoryParentId = signal<number | null>(null);

    newCategoryError = computed(() => {
        const name = this.newCategoryName().trim().toLowerCase();
        if (!name) return '';
        const parentId = this.newCategoryParentId();

        const duplicate = this.categories().some((c) => {
            const isSameName = c.value.toLowerCase() === name;
            const existingParent = c.parentId || null;
            return isSameName && existingParent === parentId;
        });

        if (duplicate) {
            return 'Ya existe una categoría con este nombre en este nivel.';
        }
        return '';
    });

    get canSaveNewCategory(): boolean {
        return this.newCategoryName().trim().length > 0 && !this.newCategoryError();
    }

    openNewCategoryForm(): void {
        this.isCreatingCategory.set(true);
        this.newCategoryName.set(this.categorySearch().trim());
        this.newCategoryParentId.set(null);
    }

    cancelNewCategory(): void {
        this.isCreatingCategory.set(false);
        this.newCategoryName.set('');
        this.newCategoryParentId.set(null);
    }

    saveNewCategory(): void {
        if (!this.canSaveNewCategory) return;
        const name = this.newCategoryName().trim();
        const parentId = this.newCategoryParentId();

        firstValueFrom(
            this.paymentService.createPaymentCategory({ value: name, parentId })
        ).then((newCat: PaymentCategory) => {
            this.paymentService.getPaymentCategories().subscribe((cats) => {
                this.categories.set(cats);
                this.form.paymentCategoryId = newCat.id!;
                this.categoryDropdownOpen.set(false);
                this.categorySearch.set('');
                this.cancelNewCategory();
            });
        }).catch((err: any) => {
            console.error('Error creando categoría:', err);
        });
    }
}
