export interface SavingsGoal {
    id?: number;
    userId: number;
    type: 'GOAL' | 'FUND'; // added
    currency: string;      // added (ARS, USD, EUR, etc)
    name: string;
    description: string;
    targetAmount: number; // For FUND this can be 0 or ignored
    currentAmount: number;
    createdDate: string;
    targetDate?: string;
    color: string;
    isActive: boolean;
}
