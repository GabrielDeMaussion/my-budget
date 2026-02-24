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
  @ViewChild('registerFormTemplate') registerFormTemplate!: TemplateRef<any>;

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

  // Register form state
  registerForm = { name: '', lastName: '', email: '', password: '', confirmPassword: '' };
  registerError = signal('');
  isRegistering = signal(false);

  // --------------- Init --------------- //
  ngOnInit(): void { }

  // --------------- Login Methods --------------- //
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

  // --------------- Register Methods --------------- //
  openRegisterDialog(): void {
    this.dialogService.close();
    this.registerForm = { name: '', lastName: '', email: '', password: '', confirmPassword: '' };
    this.registerError.set('');
    this.isRegistering.set(false);

    setTimeout(() => {
      this.dialogService.open({
        type: 'custom',
        title: 'Crear Cuenta',
        templateRef: this.registerFormTemplate,
      });
    }, 100);
  }

  backToLogin(): void {
    this.dialogService.close();
    setTimeout(() => this.openLoginDialog(), 100);
  }

  onRegisterSubmit(): void {
    this.registerError.set('');

    // Validaciones
    if (!this.registerForm.name.trim() || !this.registerForm.lastName.trim()) {
      this.registerError.set('Nombre y apellido son obligatorios.');
      return;
    }
    if (!this.registerForm.email.trim()) {
      this.registerError.set('El correo electrónico es obligatorio.');
      return;
    }
    if (this.registerForm.password.length < 4) {
      this.registerError.set('La contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (this.registerForm.password !== this.registerForm.confirmPassword) {
      this.registerError.set('Las contraseñas no coinciden.');
      return;
    }

    this.isRegistering.set(true);
    this.authService
      .registerUser({
        name: this.registerForm.name.trim(),
        lastName: this.registerForm.lastName.trim(),
        email: this.registerForm.email.trim().toLowerCase(),
        password: this.registerForm.password,
      })
      .subscribe((result) => {
        this.isRegistering.set(false);
        if (result.success) {
          this.dialogService.close();
        } else {
          this.registerError.set(result.error || 'Error al registrar usuario.');
        }
      });
  }

  // --------------- Session Methods --------------- //
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
