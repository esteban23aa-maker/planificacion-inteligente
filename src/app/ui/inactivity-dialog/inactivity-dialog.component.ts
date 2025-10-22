import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-inactivity-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule
  ],
  templateUrl: './inactivity-dialog.component.html',
  styleUrls: ['./inactivity-dialog.component.scss']
})
export class InactivityDialogComponent implements OnInit, OnDestroy {
  countdown!: number;
  private intervalId: any;

  constructor(
    private dialogRef: MatDialogRef<InactivityDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { timeoutMs: number } // ej: 30 segundos
  ) { }

  ngOnInit(): void {
    this.countdown = this.data.timeoutMs;
    this.intervalId = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        this.logout();
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }

  logout() {
    this.dialogRef.close('logout');
  }

  stay() {
    this.dialogRef.close('stay');
  }
}
