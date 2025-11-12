import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface EliminarDialogData {
  nombre: string;
}

@Component({
  standalone: true,
  selector: 'app-eliminar-colaborador-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
  <h2 mat-dialog-title>
    <mat-icon>warning_amber</mat-icon> Eliminar colaborador
  </h2>

  <div mat-dialog-content class="content">
    <p><strong>{{ data.nombre }}</strong></p>

   <!-- <div class="option soft">
      <h3>Marcado para eliminación (7 días)</h3>
      <p>Se desactiva de inmediato y sale de toda programación. Puede revertirse durante la ventana de 7 días.(Recomendado si el colaborador hace parte de grupo Compensatorio/Reducción.)</p>
      <button mat-stroked-button (click)="close('soft')">
        <mat-icon>schedule</mat-icon> Marcar para eliminación
      </button>
    </div> -->

    <div class="option hard">
      <h3>Eliminación inmediata</h3>
      <p class="warn">Acción <strong>irreversible</strong>. Se elimina de forma definitiva.</p>
      <button mat-flat-button color="warn" (click)="close('hard')">
        <mat-icon>delete_forever</mat-icon> Eliminar ahora
      </button>
    </div>
  </div>

  <div mat-dialog-actions align="end">
    <button mat-button (click)="close()">Cancelar</button>
  </div>
  `,
  styles: [`
    .content { display: grid; gap: 14px; }
    .option { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; }
    .option h3 { margin: 0 0 6px 0; font-weight: 700; }
    .warn { color: #9a3412; }
    .soft { background: #f8fafc; }
    .hard { background: #fff7ed; }
  `]
})
export class EliminarColaboradorDialogComponent {
  constructor(
    private ref: MatDialogRef<EliminarColaboradorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EliminarDialogData
  ) { }

  close(result?: 'soft' | 'hard' | undefined) { this.ref.close(result); }
}
