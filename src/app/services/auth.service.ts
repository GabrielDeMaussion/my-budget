import { computed, inject, Injectable, signal } from '@angular/core';
import { from, map, Observable, of } from 'rxjs';

import { AuthTokenPayload } from '../interfaces/authTokenPayload.interface';
import { User } from '../interfaces/user.interface';
import { DatabaseService } from './database.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // --------------- Injects --------------- //
  private readonly db = inject(DatabaseService);

  // --------------- Properties --------------- //
  private authToken = signal<string | null>(localStorage.getItem('authToken'));

  setAuthToken(token: string | null) {
    this.authToken.set(token);
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  // --------------- Computeds --------------- //
  authUser = computed(() => {
    const token = this.authToken();
    if (!token) return null;
    return this.decodeJWTToken(token);
  });

  // --------------- Methods --------------- //

  /** Login con credenciales contra IndexedDB */
  loginWithCredentials(email: string, password: string): Observable<boolean> {
    return from(this.db.getOneByIndex<User>('users', 'email', email)).pipe(
      map((user) => {
        if (user && user.password === password) {
          const token = this.createMockToken(user);
          this.setAuthToken(token);
          // Aplicar tema del usuario
          if (user.theme) {
            localStorage.setItem('app-theme', user.theme);
            document.documentElement.setAttribute('data-theme', user.theme);
          }
          return true;
        }
        return false;
      })
    );
  }

  /** Registrar un nuevo usuario en IndexedDB */
  registerUser(data: { name: string; lastName: string; email: string; password: string }): Observable<{ success: boolean; error?: string }> {
    return from(
      (async () => {
        // Verificar si el email ya existe
        const existing = await this.db.getOneByIndex<User>('users', 'email', data.email);
        if (existing) {
          return { success: false, error: 'Ya existe una cuenta con ese correo electrónico.' };
        }

        // Crear usuario
        const newUser = await this.db.add<User>('users', {
          email: data.email,
          password: data.password,
          name: data.name,
          lastName: data.lastName,
          theme: 'dark',
        } as User);

        // Auto-login después del registro
        const token = this.createMockToken(newUser);
        this.setAuthToken(token);
        localStorage.setItem('app-theme', 'dark');
        document.documentElement.setAttribute('data-theme', 'dark');

        return { success: true };
      })()
    );
  }

  logout(): void {
    this.setAuthToken(null);
  }

  /** Obtiene la configuración del usuario actual desde IndexedDB */
  getUserSettings(): Observable<User | null> {
    const user = this.authUser();
    if (!user) return of(null);
    return from(this.db.getById<User>('users', user.sub));
  }

  /** Actualiza la configuración del usuario en IndexedDB */
  updateUserSettings(data: Partial<User>): Observable<User | null> {
    const user = this.authUser();
    if (!user) return of(null);
    return from(this.db.update<User>('users', user.sub, data));
  }

  // --------------- Helpers --------------- //
  private createMockToken(user: User): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        sub: String(user.id),
        name: user.name,
        lastName: user.lastName,
        email: user.email,
      })
    );
    const signature = btoa('mock-signature');
    return `${header}.${payload}.${signature}`;
  }

  decodeJWTToken(token: string): AuthTokenPayload | null {
    try {
      const payload = token.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      return decoded;
    } catch (error) {
      console.error('Invalid token', error);
      return null;
    }
  }
}
