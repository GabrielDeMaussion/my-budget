import { Component, OnInit } from '@angular/core';
import { SessionButtonComponent } from '../../components/session-button/session-button.component';
import { Link } from '../../interfaces/link.interface';
import { RouterLink, RouterLinkActive } from "@angular/router";

@Component({
  selector: 'app-navbar',
  imports: [SessionButtonComponent, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  // --------------- Inyections --------------- //
  
  
  // --------------- Properties --------------- //
  links: Link[] = [
    { label: 'Ingresos', route: '/incomes' },
    { label: 'Gastos', route: '/expenses' },
    { label: 'Balance General', route: '/summary' }
  ]
  
  // --------------- Init --------------- //
  ngOnInit() {
  }

}
