import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';

import { environment } from '../../environments/environment';
import { AuthTokenPayload } from '../interfaces/authTokenPayload.interface';
import { LoginRequest } from '../interfaces/dtos/login-request.dto';
import { LoginResponse } from '../interfaces/dtos/login-response.dto';


@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // --------------- Injects --------------- //
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);

  // --------------- Properties --------------- //
  /** Signal inicializado con el token persistido en localStorage */
  private authToken = signal<string | null>(localStorage.getItem('authToken'));

  /** Setter del token guardado en localStorage (permite null para limpiar sesión) */
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
    console.log('Calculando nuevo usuario a partir del token:', token);
    
    if (!token) return null;
    return this.decodeJWTToken(token);
  });

  // --------------- Methods --------------- //
  login(dto: LoginRequest) {
    this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, dto).subscribe({
      next: (response) => {
        this.setAuthToken(response.token);
        console.log('Login Successfull.');
      },
      error: (error) => {
        console.error('Login failed', error);
      }
    });
  }

  
  // --------------- Helpers --------------- //
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
