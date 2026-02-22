import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  // --------------- Injects --------------- //
  private readonly apiUrl = environment.apiUrl;
  private readonly http = inject(HttpClient);
  
  // --------------- Signals --------------- //
  authToken = signal<string | null>(null);
  
  // --------------- Computeds --------------- //
  authUser = computed(() => {
    const token = this.authToken();
    if (!token) return null;
    return this.decodeJWTToken(token);
  });
  
  // --------------- Methods --------------- //
  login(username: string, password: string) {
    // Example login method
    const token = 'example-token';
    this.authToken.set(token);
  }
  
decodeJWTToken(token: string) {
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
