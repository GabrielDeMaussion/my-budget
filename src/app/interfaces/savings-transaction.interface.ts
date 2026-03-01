export interface SavingsTransaction {
    id?: number;
    goalId: number;
    amount: number;
    date: string;
    type: 'DEPOSIT' | 'WITHDRAWAL';
    notes?: string;
}
