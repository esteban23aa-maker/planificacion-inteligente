import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';

interface ConfirmData {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

@Component({
  standalone: true,
  selector: 'app-confirm-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title || 'Confirmación' }}</h2>
    <div mat-dialog-content>
      <p>{{ data.message }}</p>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button (click)="close(false)">{{ data.cancelText || 'Cancelar' }}</button>
      <button mat-flat-button color="primary" (click)="close(true)">{{ data.confirmText || 'Aceptar' }}</button>
    </div>
  `
})
export class ConfirmDialogComponent {
  constructor(
    private ref: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmData
  ) { }
  close(v: boolean) { this.ref.close(v); }
}
