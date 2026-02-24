import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface InstanceEditResult {
    amount: number;
    comments: string;
}

@Component({
    selector: 'app-instance-edit-form',
    imports: [CommonModule, FormsModule],
    templateUrl: './instance-edit-form.component.html',
    styleUrls: ['./instance-edit-form.component.css'],
})
export class InstanceEditFormComponent {
    // --------------- Inputs --------------- //
    initialAmount = input.required<number>();
    initialComments = input.required<string>();

    // --------------- Outputs --------------- //
    formSubmit = output<InstanceEditResult>();
    formCancel = output<void>();

    // --------------- State --------------- //
    form = {
        amount: 0,
        comments: '',
    };

    private initialized = false;

    // --------------- Lifecycle --------------- //
    ngOnChanges(): void {
        if (!this.initialized) {
            this.form.amount = this.initialAmount();
            this.form.comments = this.initialComments();
            this.initialized = true;
        }
    }

    ngOnInit(): void {
        this.form.amount = this.initialAmount();
        this.form.comments = this.initialComments();
    }

    // --------------- Methods --------------- //
    onSubmit(): void {
        if (this.form.amount < 0 || isNaN(this.form.amount)) return;
        this.formSubmit.emit({
            amount: this.form.amount,
            comments: this.form.comments,
        });
    }

    onCancel(): void {
        this.formCancel.emit();
    }

    isValid(): boolean {
        return this.form.amount >= 0 && !isNaN(this.form.amount);
    }
}
