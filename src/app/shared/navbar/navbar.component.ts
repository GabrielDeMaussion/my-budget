import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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

  // --------------- View --------------- //
  @ViewChild('drawerToggle') drawerToggle!: ElementRef<HTMLInputElement>;

  // --------------- Properties --------------- //
  links: Link[] = [
    { label: 'Ingresos', route: '/incomes' },
    { label: 'Gastos', route: '/expenses' },
    { label: 'Planes', route: '/payment-plans' },
    { label: 'Balance General', route: '/summary' }
  ]

  // --------------- Init --------------- //
  ngOnInit() {
  }

  // --------------- Methods --------------- //
  closeDrawer(): void {
    if (this.drawerToggle?.nativeElement) {
      this.drawerToggle.nativeElement.checked = false;
    }
  }

}
