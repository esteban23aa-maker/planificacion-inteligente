import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';


@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html'
})
export class NavbarComponent {
  private auth = inject(AuthService);
  private router = inject(Router);


  session$ = this.auth.session$;


  hasRole(...roles: string[]) { return this.auth.hasRole(...roles); }


  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
