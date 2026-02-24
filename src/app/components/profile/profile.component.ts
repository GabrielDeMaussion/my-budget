import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);

  isLoading = signal(false);
  isSaving = signal(false);

  // Profile data
  profileData = signal({
    name: '',
    lastName: '',
    email: '',
    phone: '+1 (555) 123-4567',
    jobTitle: 'Ingeniero de Software',
    location: 'Buenos Aires, Argentina'
  });

  ngOnInit() {
    const user = this.authService.authUser();
    if (user) {
      this.profileData.update(d => ({
        ...d,
        name: user.name || '',
        lastName: user.lastName || '',
        email: user.email || ''
      }));
    }
  }

  saveProfile() {
    this.isSaving.set(true);
    // Simular guardado
    setTimeout(() => {
      this.isSaving.set(false);
    }, 1000);
  }
}
