import { Component, inject, OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-session-button',
  templateUrl: './session-button.component.html',
  styleUrls: ['./session-button.component.css']
})
export class SessionButtonComponent implements OnInit {
  private readonly authService = inject(AuthService);

  ngOnInit() {
  }

}
