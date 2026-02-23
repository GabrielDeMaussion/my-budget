import { Component, computed, inject, OnInit, signal, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DialogService } from '../../services/dialog.service';
import { MenuComponent, MenuItem } from '../../shared/menu/menu.component';

@Component({
  selector: 'app-session-button',
  imports: [CommonModule, FormsModule, MenuComponent],
  templateUrl: './session-button.component.html',
  styleUrls: ['./session-button.component.css'],
})
export class SessionButtonComponent implements OnInit {
  // --------------- Injects --------------- //
  readonly authService = inject(AuthService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);

  // --------------- ViewChild --------------- //
  @ViewChild('loginFormTemplate') loginFormTemplate!: TemplateRef<any>;

  // --------------- Properties --------------- //
  isLoggedIn = computed(() => !!this.authService.authUser());

  menuItems: MenuItem[] = [
    { id: 'settings', label: 'Configuración', icon: 'gear' },
    { id: 'profile', label: 'Perfil', icon: 'person' },
    { id: 'logout', label: 'Cerrar Sesión', icon: 'box-arrow-right' },
  ];

  // Login form state
  loginForm = { email: '', password: '' };
  loginError = signal(false);

  // --------------- Init --------------- //
  ngOnInit(): void {}

  // --------------- Methods --------------- //
  openLoginDialog(): void {
    this.loginForm = { email: '', password: '' };
    this.loginError.set(false);
    this.dialogService.open({
      type: 'custom',
      title: 'Iniciar Sesión',
      templateRef: this.loginFormTemplate,
    });
  }

  onLoginSubmit(): void {
    this.loginError.set(false);
    this.authService
      .loginWithCredentials(this.loginForm.email, this.loginForm.password)
      .subscribe((success) => {
        if (success) {
          this.dialogService.close();
        } else {
          this.loginError.set(true);
        }
      });
  }

  onLoginCancel(): void {
    this.dialogService.close();
  }

  logout(): void {
    this.authService.logout();
  }

  onMenuAction(actionId: string): void {
    switch (actionId) {
      case 'settings':
        this.router.navigate(['/settings']);
        break;
      case 'profile':
        this.router.navigate(['/profile']);
        break;
      case 'logout':
        this.logout();
        break;
    }
  }
}
