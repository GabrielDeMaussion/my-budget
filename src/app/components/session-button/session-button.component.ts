import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-session-button',
  imports: [CommonModule],
  templateUrl: './session-button.component.html',
  styleUrls: ['./session-button.component.css']
})
export class SessionButtonComponent implements OnInit {
  // --------------- Injects --------------- //
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  
  // --------------- Properties --------------- //
  isLoggedIn = computed(() => !!this.authService.authUser());
  

  // --------------- Init --------------- //
  ngOnInit() {
    // this.forceLogin();
  }
  
  // --------------- Methods --------------- //
  forceLogin() {
    console.log('Iniciando sesion...');
    this.authService.setAuthToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkiLCJuYW1lIjoiYWRtaW4iLCJsYXN0TmFtZSI6InN1cGVyIiwiZW1haWwiOiJhZG1pbkBnbWFpbC5jb20ifQ.GPb4aSUJct2WhehqAB0rxUjXmnI0sK60x6-yCZKNwoI')
  }
  
  login() {
    console.log('WIP');
  }
  
  logout() {
    this.authService.setAuthToken(null);
  }
  
  onProfile() {
    this.router.navigate(['/profile']);
  }

}
