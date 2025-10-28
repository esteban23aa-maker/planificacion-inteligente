import { Component, Inject, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import { IncidenciasY2AdminService } from 'src/app/core/services/incidencias-y2-admin.service';
import {
  AplicarIncidenciaRequest,
  CandidatoY2DTO,
  IncidenciaY2DTO
} from 'src/app/core/models/incidencias-y2.models';

@Component({
  selector: 'app-candidatos-incidencia-dialog',
  standalone: true,
  imports: [
    CommonModule, MatDialogModule, MatTableModule, MatFormFieldModule,
    MatSelectModule, MatButtonModule, MatChipsModule, MatIconModule,
    MatSnackBarModule, MatInputModule, MatTooltipModule
  ],
  template: `
  <h2 mat-dialog-title>Elegir candidato · {{inc.colaboradorNombre}} · {{ inc.fecha | date:'EEE d/MM' }}</h2>
  <div mat-dialog-content class="content">
    <div class="meta">
      <div><strong>Turno:</strong> {{ inc.turno || '—' }}</div>
      <div><strong>Franja:</strong> {{ inc.franja || '—' }}</div>
      <div><strong>Motivo:</strong> {{ inc.motivo }}</div>
    </div>

    <div class="table">
      <table mat-table [dataSource]="ds">

        <ng-container matColumnDef="nombre">
          <th mat-header-cell *matHeaderCellDef> Candidato </th>
          <td mat-cell *matCellDef="let c">
            <div class="cand-nombre">{{ c.nombre }}</div>
            <div class="cand-sub">Grupo: {{ c.grupo }} · Puesto: {{ c.puestoBase || '—' }}</div>
          </td>
        </ng-container>

        <ng-container matColumnDef="puntaje">
          <th mat-header-cell *matHeaderCellDef> Puntaje </th>
          <td mat-cell *matCellDef="let c"> {{ c.puntaje }} </td>
        </ng-container>

        <ng-container matColumnDef="flags">
          <th mat-header-cell *matHeaderCellDef> Estado </th>
          <td mat-cell *matCellDef="let c">
            <mat-chip [color]="c.compatible ? 'primary' : 'warn'" [disabled]="true">{{ c.compatible ? 'Compatible' : 'No compatible' }}</mat-chip>
            <mat-chip [color]="!c.superaLimiteDia ? 'primary' : 'warn'" [disabled]="true">{{ c.superaLimiteDia ? 'Límite día' : 'Disponible' }}</mat-chip>
            <mat-chip [color]="!c.colisionTurnoDistinto ? 'primary' : 'warn'" [disabled]="true">Turno {{ c.colisionTurnoDistinto ? 'ocupado' : 'ok' }}</mat-chip>
            <mat-chip [color]="!c.colisionMismaFranja ? 'primary' : 'warn'" [disabled]="true">Franja {{ c.colisionMismaFranja ? 'ocupada' : 'ok' }}</mat-chip>
          </td>
        </ng-container>

        <ng-container matColumnDef="razones">
          <th mat-header-cell *matHeaderCellDef> Razones </th>
          <td mat-cell *matCellDef="let c">
            <span class="razon" *ngFor="let r of c.razones">{{ r }}</span>
          </td>
        </ng-container>

        <ng-container matColumnDef="seleccionar">
          <th mat-header-cell *matHeaderCellDef> </th>
          <td mat-cell *matCellDef="let c">
            <button mat-stroked-button (click)="select(c)" [disabled]="!esElegible(c)">Elegir</button>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="cols"></tr>
        <tr mat-row *matRowDef="let row; columns: cols"></tr>
      </table>
    </div>

    <div class="config">
      <div class="row">
        <mat-form-field appearance="fill">
          <mat-label>Modalidad</mat-label>
          <mat-select [(value)]="modalidad">
            <mat-option value="FRACCIONADO" *ngIf="franja() !== 'DIA_COMPLETO'">FRACCIONADO (4h)</mat-option>
            <mat-option value="COMPLETO" *ngIf="franja() === 'DIA_COMPLETO' || !franja()">COMPLETO (8h)</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="fill">
          <mat-label>Horas</mat-label>
          <input matInput type="number" [value]="horas()" readonly>
        </mat-form-field>
      </div>
    </div>
  </div>

  <div mat-dialog-actions align="end">
    <button mat-stroked-button mat-dialog-close>Cancelar</button>
  </div>
  `,
  styles: [`
    .content { display: grid; grid-template-rows: auto auto auto; gap: 12px; }
    .meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; }
    .table { max-height: 420px; overflow: auto; border: 1px solid #e5e7eb; border-radius: 12px; }
    table { width: 100%; }
    .cand-nombre { font-weight: 600; }
    .cand-sub { font-size: 12px; color: #6b7280; }
    .razon { font-size: 12px; color: #374151; background: #f3f4f6; border-radius: 999px; padding: 2px 8px; margin-right: 6px; }
    .config .row { display: grid; grid-template-columns: 240px 120px; gap: 12px; align-items: center; }
  `]
})
export class CandidatosIncidenciaDialogComponent implements OnInit {
  private svc = inject(IncidenciasY2AdminService);
  private snack = inject(MatSnackBar);

  inc!: IncidenciaY2DTO;
  ds = new MatTableDataSource<CandidatoY2DTO>([]);
  cols = ['nombre', 'puntaje', 'flags', 'razones', 'seleccionar'];

  modalidad: 'FRACCIONADO' | 'COMPLETO' = 'FRACCIONADO';

  constructor(
    private ref: MatDialogRef<CandidatosIncidenciaDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { incidencia: IncidenciaY2DTO }
  ) {
    this.inc = data.incidencia;
  }

  franja = signal(this.inc.franja || null);
  horas = computed(() => (this.modalidad === 'COMPLETO' ? 8 : 4));

  ngOnInit(): void {
    // Si ya vienen candidatos precalculados, muéstralos; si no, consulta
    if (this.inc.candidatos?.length) {
      this.ds.data = this.inc.candidatos;
    } else {
      // Puedes usar this.svc.getCandidatos(...) también: ambos existen
      this.svc.candidatos(this.inc.id).subscribe({
        next: (list: CandidatoY2DTO[]) => this.ds.data = list ?? [],
        error: (e: unknown) => {
          this.snack.open('Error cargando candidatos', 'Cerrar', { duration: 2500 });
          console.error(e);
        }
      });
    }

    // Modalidad por defecto según franja
    if (this.franja() === 'DIA_COMPLETO' || !this.franja()) {
      this.modalidad = 'COMPLETO';
    } else {
      this.modalidad = 'FRACCIONADO';
    }
  }

  esElegible(c: CandidatoY2DTO): boolean {
    // Permite incluso candidatos con flags en contra (se validará en backend),
    // pero si quieres ser más estricto en UI:
    if (!c.compatible) return false;
    if (c.superaLimiteDia) return false;
    if (c.colisionTurnoDistinto) return false;
    if (this.modalidad === 'FRACCIONADO' && c.colisionMismaFranja) return false;
    return true;
  }

  select(c: CandidatoY2DTO) {
    const req: AplicarIncidenciaRequest = {
      incidenciaId: this.inc.id,
      reemplazoId: c.id,
      modalidad: this.modalidad,
      horas: this.modalidad === 'COMPLETO' ? 8 : 4,
      turno: this.inc.turno ?? undefined,
      franja: this.inc.franja ?? (this.modalidad === 'COMPLETO' ? 'DIA_COMPLETO' : undefined)
    };
    this.ref.close(req);
  }
}
