import {
    Component,
    ElementRef,
    HostListener,
    input,
    OnInit,
    output,
    signal,
    computed,
    ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SelectOption {
    value: string | number;
    label: string;
}

@Component({
    selector: 'app-searchable-select',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './searchable-select.component.html',
    styleUrls: ['./searchable-select.component.css'],
})
export class SearchableSelectComponent implements OnInit {
    // --------------- Inputs --------------- //
    options = input.required<SelectOption[]>();
    value = input<string | number>('');
    placeholder = input<string>('Seleccionar...');
    emptyLabel = input<string>('Todos'); // Default empty selection label
    widthClass = input<string>('w-full');

    // --------------- Outputs --------------- //
    valueChange = output<string | number>();

    // --------------- State --------------- //
    isOpen = signal(false);
    searchQuery = signal('');

    // Dropdown orientation
    dropdownTop = signal(0);
    dropdownLeft = signal(0);
    dropdownWidth = signal(0);
    openUpward = signal(false);

    @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
    @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

    // --------------- Computeds --------------- //
    filteredOptions = computed(() => {
        const query = this.searchQuery().toLowerCase();
        if (!query) return this.options();
        return this.options().filter(o => o.label.toLowerCase().includes(query));
    });

    selectedLabel = computed(() => {
        const val = this.value();
        if (val === '' || val === null || val === undefined) return this.emptyLabel();
        const found = this.options().find(o => o.value == val);
        return found ? found.label : this.emptyLabel();
    });

    ngOnInit(): void { }

    toggleOpen(): void {
        if (this.isOpen()) {
            this.close();
            return;
        }

        this.calculatePosition();
        this.isOpen.set(true);

        // Auto focus search
        setTimeout(() => {
            if (this.searchInput?.nativeElement) {
                this.searchInput.nativeElement.focus();
            }
        });
    }

    private calculatePosition(): void {
        if (!this.containerRef?.nativeElement) return;

        const rect = this.containerRef.nativeElement.getBoundingClientRect();
        this.dropdownWidth.set(rect.width);
        this.dropdownLeft.set(rect.left);

        const dropdownHeight = 250; // max-h constraint in template
        const viewportHeight = window.innerHeight;

        // Check if it fits below
        if (rect.bottom + dropdownHeight + 10 > viewportHeight && rect.top > dropdownHeight + 10) {
            // Open upward
            this.openUpward.set(true);
            this.dropdownTop.set(rect.top - 8);
        } else {
            // Open downward
            this.openUpward.set(false);
            this.dropdownTop.set(rect.bottom + 8);
        }
    }

    selectOption(val: string | number): void {
        this.valueChange.emit(val);
        this.close();
    }

    close(): void {
        this.isOpen.set(false);
        this.searchQuery.set(''); // reset search when closed
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        if (!this.isOpen()) return;

        const target = event.target as HTMLElement;
        // If click is outside component, close
        if (!this.containerRef?.nativeElement.contains(target) &&
            !target.closest('.searchable-dropdown-menu')) {
            this.close();
        }
    }
}
