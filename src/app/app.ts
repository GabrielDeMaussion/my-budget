import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { DialogComponent } from './shared/dialog/dialog.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, DialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('my-budget');

  ngOnInit(): void {
    const theme = localStorage.getItem('app-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }
}
