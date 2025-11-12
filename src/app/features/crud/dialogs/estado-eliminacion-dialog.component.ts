import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { interval, Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface EstadoEliminacionData {
  id: number;
  nombre: string;
  fechaEliminacionProgramada?: string; // ISO yyyy-MM-dd
}

@Component({
  standalone: true,
  selector: 'app-estado-eliminacion-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
  <h2 mat-dialog-title>
    <mat-icon class="title-icon">hourglass_bottom</mat-icon>
    Estado de eliminación
  </h2>

  <div mat-dialog-content class="content">
    <p><strong>{{ data.nombre }}</strong></p>

    <ng-container *ngIf="data.fechaEliminacionProgramada; else sinFecha">
      <p>Programado para el: <strong>{{ data.fechaEliminacionProgramada }}</strong></p>
      <div class="timer" [attr.aria-live]="'polite'">
        Falta: <strong>{{ restante }}</strong>
      </div>
    </ng-container>

    <ng-template #sinFecha>
      <p>No hay fecha de eliminación programada.</p>
    </ng-template>
  </div>

  <div mat-dialog-actions class="actions-spaced">
    <button mat-stroked-button (click)="close()">Cerrar</button>
    <span class="spacer"></span>
    <button mat-flat-button color="primary"
            (click)="revertir()" *ngIf="data.fechaEliminacionProgramada">
      <mat-icon>history</mat-icon> Revertir eliminación
    </button>
  </div>
  `,
  styles: [`
    .content { display: grid; gap: 10px; }
    .timer { font-size: 1.1rem; }
    .title-icon { vertical-align: middle; margin-right: .35rem; }

    /* ← estos dos estilos son los que separan los botones */
    .actions-spaced { display: flex; align-items: center; width: 100%; }
    .actions-spaced .spacer { flex: 1 1 auto; }
  `]
})
export class EstadoEliminacionDialogComponent implements OnInit, OnDestroy {
  restante = '—';
  private sub?: Subscription;

  constructor(
    private ref: MatDialogRef<EstadoEliminacionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EstadoEliminacionData
  ) { }

  ngOnInit(): void {
    if (!this.data.fechaEliminacionProgramada) return;
    this.calc();
    this.sub = interval(1000).subscribe(() => this.calc());
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  private calc(): void {
    // Fin del día local (ajusta a '-05:00' si quieres forzar Bogotá: '...T23:59:59-05:00')
    const end = new Date(this.data.fechaEliminacionProgramada! + 'T23:59:59');
    const now = new Date();
    const diff = Math.max(0, end.getTime() - now.getTime());

    if (diff === 0) {
      this.restante = 'Listo para purga';
      this.sub?.unsubscribe();
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);
    this.restante = `${d}d ${h}h ${m}m ${s}s`;
  }

  // Devuelvo una señal para que el padre haga la llamada HTTP y muestre el toast
  revertir() { this.ref.close('revert'); }
  close() { this.ref.close(); }
}
