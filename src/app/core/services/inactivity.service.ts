import { Injectable, NgZone } from '@angular/core';
import { AuthService } from './auth.service';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { InactivityDialogComponent } from '../../ui/inactivity-dialog/inactivity-dialog.component';

@Injectable({ providedIn: 'root' })
export class InactivityService {
  private timeoutId: any;
  private readonly timeoutMs = 10 * 60 * 1000; // 10 minutos
  constructor(
    private auth: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private ngZone: NgZone
  ) { }

  initListener(): void {
    const resetTimer = () => {
      clearTimeout(this.timeoutId);

      if (this.auth.isAuthenticated()) {
        this.timeoutId = setTimeout(() => {
          this.ngZone.run(() => this.showInactivityDialog());
        }, this.timeoutMs);
      }
    };

    ['click', 'mousemove', 'keydown'].forEach(evt =>
      document.addEventListener(evt, resetTimer)
    );

    resetTimer();
  }

  private showInactivityDialog(): void {
    const dialogRef = this.dialog.open(InactivityDialogComponent, {
      width: '400px',
      disableClose: true,
      data: { timeoutMs: 30 } // 30 segundos de cuenta regresiva
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'logout') {
        this.auth.logout();
        this.router.navigate(['/login']);
      } else {
        this.initListener(); // reinicia el timer
      }
    });
  }
}
