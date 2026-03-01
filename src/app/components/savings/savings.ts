import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SavingsService } from '../../services/savings.service';
import { AuthService } from '../../services/auth.service';
import { SavingsGoal } from '../../interfaces/savings-goal.interface';
import { SavingsTransaction } from '../../interfaces/savings-transaction.interface';
import { firstValueFrom } from 'rxjs';

interface CurrencyTotal {
  currency: string;
  saved: number;
  target: number;
  progress: number | null; // null if no target (FUND only)
}

@Component({
  selector: 'app-savings',
  imports: [CommonModule, FormsModule],
  templateUrl: './savings.html',
  styleUrls: ['./savings.css'],
})
export class Savings implements OnInit {
  private readonly savingsService = inject(SavingsService);
  private readonly authService = inject(AuthService);

  goals = signal<SavingsGoal[]>([]);
  isLoading = signal(true);

  // Available Currencies
  readonly currencies = ['ARS', 'USD', 'EUR', 'BRL', 'USDT', 'BTC', 'ETH'];

  // Currency Grouped Totals
  totalsByCurrency = computed<CurrencyTotal[]>(() => {
    const map = new Map<string, { saved: number, target: number }>();
    for (const g of this.goals()) {
      const c = g.currency;
      if (!map.has(c)) {
        map.set(c, { saved: 0, target: 0 });
      }
      const existing = map.get(c)!;
      existing.saved += g.currentAmount;
      if (g.type === 'GOAL') existing.target += g.targetAmount;
    }

    return Array.from(map.entries()).map(([currency, data]) => {
      let progress: number | null = null;
      if (data.target > 0) {
        progress = Math.min(100, Math.round((data.saved / data.target) * 100));
      }
      return {
        currency,
        saved: data.saved,
        target: data.target,
        progress
      };
    }).sort((a, b) => b.saved - a.saved); // sort by highest saved amount
  });

  // UI State - Goal Form
  showGoalModal = signal(false);
  editingGoal = signal<SavingsGoal | null>(null);
  goalFormName = signal('');
  goalFormType = signal<'GOAL' | 'FUND'>('FUND');
  goalFormCurrency = signal('ARS');
  goalFormTarget = signal<number>(0);
  goalFormInitial = signal<number>(0);
  goalFormDesc = signal('');
  goalFormColor = signal('#3b82f6'); // default blue

  // UI State - Transaction Form
  showTxModal = signal(false);
  activeTxGoal = signal<SavingsGoal | null>(null);
  txFormAmount = signal<number>(0);
  txFormType = signal<'DEPOSIT' | 'WITHDRAWAL'>('DEPOSIT');
  txFormNotes = signal('');

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    const user = this.authService.authUser();
    if (!user) return;
    this.isLoading.set(true);
    try {
      const dbGoals = await firstValueFrom(this.savingsService.getGoalsByUserId(Number(user.sub)));
      this.goals.set(dbGoals);
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoading.set(false);
    }
  }

  // --- Goal Actions ---
  openCreateGoal() {
    this.editingGoal.set(null);
    this.goalFormName.set('');
    this.goalFormType.set('FUND');
    this.goalFormCurrency.set('ARS');
    this.goalFormTarget.set(0);
    this.goalFormInitial.set(0);
    this.goalFormDesc.set('');
    this.goalFormColor.set('#3b82f6');
    this.showGoalModal.set(true);
  }

  openEditGoal(g: SavingsGoal) {
    this.editingGoal.set(g);
    this.goalFormName.set(g.name);
    this.goalFormType.set(g.type);
    this.goalFormCurrency.set(g.currency);
    this.goalFormTarget.set(g.targetAmount);
    this.goalFormInitial.set(g.currentAmount); // Not visible during edit, but set for logic safety
    this.goalFormDesc.set(g.description || '');
    this.goalFormColor.set(g.color || '#3b82f6');
    this.showGoalModal.set(true);
  }

  async saveGoal() {
    const user = this.authService.authUser();
    if (!user) return;

    const name = this.goalFormName().trim();
    const type = this.goalFormType();
    const target = this.goalFormTarget();

    if (!name) return;
    if (type === 'GOAL' && target <= 0) return;

    const finalTarget = type === 'FUND' ? 0 : target;

    const g = this.editingGoal();
    if (g) {
      // Edit
      await firstValueFrom(this.savingsService.updateGoal(g.id!, {
        name,
        type,
        currency: this.goalFormCurrency(),
        targetAmount: finalTarget,
        description: this.goalFormDesc(),
        color: this.goalFormColor(),
      }));
    } else {
      // Create
      const newGoal: SavingsGoal = {
        userId: Number(user.sub),
        type,
        currency: this.goalFormCurrency(),
        name,
        targetAmount: finalTarget,
        currentAmount: 0,
        description: this.goalFormDesc(),
        color: this.goalFormColor(),
        createdDate: new Date().toISOString().split('T')[0],
        isActive: true
      };

      const createdGoal = await firstValueFrom(this.savingsService.createGoal(newGoal));

      if (this.goalFormInitial() > 0) {
        await this.savingsService.addTransaction({
          goalId: createdGoal.id!,
          amount: this.goalFormInitial(),
          type: 'DEPOSIT',
          date: new Date().toISOString().split('T')[0],
          notes: 'Saldo inicial / Apertura'
        });
      }
    }

    this.showGoalModal.set(false);
    this.loadData();
  }

  async deleteGoal(g: SavingsGoal) {
    if (confirm(`¿Estás seguro de que quieres eliminar ${g.name}?`)) {
      await firstValueFrom(this.savingsService.deleteGoal(g.id!));
      this.loadData();
    }
  }

  // --- Transaction Actions ---
  openTransaction(g: SavingsGoal, type: 'DEPOSIT' | 'WITHDRAWAL') {
    this.activeTxGoal.set(g);
    this.txFormType.set(type);
    this.txFormAmount.set(0);
    this.txFormNotes.set('');
    this.showTxModal.set(true);
  }

  async saveTransaction() {
    const goal = this.activeTxGoal();
    const amt = this.txFormAmount();
    if (!goal || amt <= 0) return;

    const tx: SavingsTransaction = {
      goalId: goal.id!,
      amount: amt,
      type: this.txFormType(),
      date: new Date().toISOString().split('T')[0],
      notes: this.txFormNotes()
    };

    await this.savingsService.addTransaction(tx);

    this.showTxModal.set(false);
    this.loadData();
  }

  getGoalProgress(g: SavingsGoal): number | null {
    if (g.type === 'FUND' || g.targetAmount === 0) return null;
    return Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100));
  }
}
