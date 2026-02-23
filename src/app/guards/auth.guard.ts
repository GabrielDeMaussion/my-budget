import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard funcional que protege rutas que requieren autenticación.
 * Si el usuario no está autenticado, redirige a /home.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.authUser()) {
    return true;
  }

  router.navigate(['/home']);
  return false;
};
