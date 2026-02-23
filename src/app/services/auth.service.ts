import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { map, Observable, of, tap } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthTokenPayload } from '../interfaces/authTokenPayload.interface';
import { User } from '../interfaces/user.interface';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // --------------- Injects --------------- //
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

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

  /** Login con credenciales contra json-server */
  loginWithCredentials(email: string, password: string): Observable<boolean> {
    return this.http
      .get<User[]>(`${this.apiUrl}/users?email=${email}&password=${password}`)
      .pipe(
        map((users) => {
          if (users.length > 0) {
            const user = users[0];
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

  logout(): void {
    this.setAuthToken(null);
  }

  /** Obtiene la configuración del usuario actual */
  getUserSettings(): Observable<User | null> {
    const user = this.authUser();
    if (!user) return of(null);
    return this.http.get<User>(`${this.apiUrl}/users/${user.sub}`);
  }

  /** Actualiza la configuración del usuario */
  updateUserSettings(data: Partial<User>): Observable<User | null> {
    const user = this.authUser();
    if (!user) return of(null);
    return this.http.patch<User>(`${this.apiUrl}/users/${user.sub}`, data);
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
