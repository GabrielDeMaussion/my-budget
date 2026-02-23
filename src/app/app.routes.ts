import { Routes } from '@angular/router';
import { HomeComponent } from './components/home/home.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    {
        path: '',
        redirectTo: '/home',
        pathMatch: 'full'
    },
    {
        path: 'home',
        component: HomeComponent
    },
    {
        path: 'profile',
        loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent),
        canActivate: [authGuard]
    },
    {
        path: 'incomes',
        loadComponent: () => import('./components/incomes/incomes.component').then(m => m.IncomesComponent),
        canActivate: [authGuard]
    },
    {
        path: 'expenses',
        loadComponent: () => import('./components/expenses/expenses.component').then(m => m.ExpensesComponent),
        canActivate: [authGuard]
    },
    {
        path: 'summary',
        loadComponent: () => import('./components/summary/summary.component').then(m => m.SummaryComponent),
        canActivate: [authGuard]
    },
    {
        path: 'settings',
        loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent),
        canActivate: [authGuard]
    },
    {
        path: '404',
        loadComponent: () => import('./components/not-found/not-found.component').then(m => m.NotFoundComponent)
    },
    {
        path: '**',
        redirectTo: '/404'
    }
    
];
