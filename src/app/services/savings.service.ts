import { inject, Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import { DatabaseService } from './database.service';
import { SavingsGoal } from '../interfaces/savings-goal.interface';
import { SavingsTransaction } from '../interfaces/savings-transaction.interface';

@Injectable({
    providedIn: 'root'
})
export class SavingsService {
    private readonly db = inject(DatabaseService);

    getGoalsByUserId(userId: number): Observable<SavingsGoal[]> {
        return from(this.db.getByIndex<SavingsGoal>('savingsGoals', 'userId', userId));
    }

    getGoalById(id: number): Observable<SavingsGoal> {
        return from(this.db.getById<SavingsGoal>('savingsGoals', id));
    }

    createGoal(goal: SavingsGoal): Observable<SavingsGoal> {
        goal.currentAmount = 0;
        goal.isActive = true;
        goal.createdDate = new Date().toISOString().split('T')[0];
        return from(this.db.add('savingsGoals', goal));
    }

    updateGoal(id: number, changes: Partial<SavingsGoal>): Observable<SavingsGoal> {
        return from(this.db.update<SavingsGoal>('savingsGoals', id, changes));
    }

    deleteGoal(id: number): Observable<void> {
        return from(this.db.delete('savingsGoals', id));
    }

    getTransactionsByGoalId(goalId: number): Observable<SavingsTransaction[]> {
        return from(this.db.getByIndex<SavingsTransaction>('savingsTransactions', 'goalId', goalId));
    }

    async addTransaction(tx: SavingsTransaction): Promise<SavingsTransaction> {
        // Save tx
        const newTx = await this.db.add('savingsTransactions', tx);

        // Update goal amount
        const goal = await this.db.getById<SavingsGoal>('savingsGoals', tx.goalId);
        if (tx.type === 'DEPOSIT') {
            goal.currentAmount += tx.amount;
        } else {
            goal.currentAmount -= tx.amount;
        }
        await this.db.update('savingsGoals', goal.id!, { currentAmount: goal.currentAmount });

        return newTx;
    }
}
