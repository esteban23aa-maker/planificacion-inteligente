import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // ✅ necesario para [(ngModel)]
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';

type Mode = 'LUNES' | 'SABADO' | 'AMBOS' | 'NINGUNO';

interface GenerarSemanaDialogData {
  mensaje: string;
  checkboxManana: boolean;
  checkboxNoche: boolean;
}

@Component({
  standalone: true,
  selector: 'app-generar-semana-dialog',
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatCheckboxModule],
  template: `
    <h2 mat-dialog-title>Generar semana</h2>
    <div mat-dialog-content>
      <p class="mb-3">{{ data.mensaje }}</p>

      <mat-checkbox [(ngModel)]="manana">Programar domingo turno 06:00–14:00</mat-checkbox><br>
      <mat-checkbox [(ngModel)]="noche" class="mt-2">Programar domingo Séptima noche</mat-checkbox>
    </div>
    <div mat-dialog-actions align="end">
      <button mat-stroked-button (click)="close(false)">Cancelar</button>
      <button mat-flat-button color="primary" (click)="confirm()">Aceptar</button>
    </div>
  `
})
export class GenerarSemanaDialogComponent {
  manana = false;
  noche = false;

  constructor(
    private ref: MatDialogRef<GenerarSemanaDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: GenerarSemanaDialogData
  ) {
    this.manana = !!data.checkboxManana;
    this.noche = !!data.checkboxNoche;
  }

  private mode(): Mode {
    if (this.manana && this.noche) return 'AMBOS';
    if (this.manana) return 'LUNES';
    if (this.noche) return 'SABADO';
    return 'NINGUNO';
  }

  confirm() { this.ref.close({ confirmed: true, mode: this.mode() }); }
  close(v: boolean) { this.ref.close({ confirmed: v }); }
}
