import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import {
  IncidenciasY2AdminService,
  AgendaSemanaDTO,
  AgendaSlotDTO,
  CrearHoldRequest,
  HoldDTO
} from 'src/app/core/services/incidencias-y2-admin.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatChipsModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressBarModule
  ],
  selector: 'app-agenda-semanal-dialog',
  template: `
  <h2 mat-dialog-title>
    Agenda semanal (L–S)
    <small *ngIf="data?.modoLibre" class="muted">· modo libre</small>
  </h2>

  <div class="p-2" *ngIf="loading">
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  </div>

  <div class="content" *ngIf="!loading">
    <div class="slot" *ngFor="let s of agenda?.items">
      <div class="slot-hdr">
        <div>
          <div class="titular">{{ s.titularNombre }}</div>
          <div class="meta">
            {{ s.fecha }} · {{ s.turno }} · {{ s.franja }} · {{ s.puesto || 'SIN PUESTO' }}
          </div>
        </div>
      </div>

      <div class="cand-list">
        <ng-container *ngIf="s.candidatos?.length; else noC">
          <button class="cand-btn"
                  *ngFor="let c of s.candidatos | slice:0:12"
                  [disabled]="c.holdActivo || (c.disponible === false)"
                  mat-raised-button
                  (click)="holdAndPrepare(s, c)">
            <mat-icon *ngIf="c.holdActivo">lock_clock</mat-icon>
            {{ c.nombre }} <span class="muted">({{ c.puntaje }})</span>
          </button>
          <span class="muted" *ngIf="s.candidatos.length > 12">+{{ s.candidatos.length - 12 }} más…</span>
        </ng-container>
        <ng-template #noC><span class="muted">Sin candidatos</span></ng-template>
      </div>
    </div>
  </div>

  <div class="footer">
    <button mat-stroked-button (click)="close()">Cerrar</button>
  </div>
  `,
  styles: [`
    .content { max-height: 70vh; overflow: auto; display: grid; gap: 12px; }
    .slot { border: 1px solid #e5e7eb; border-radius: 12px; padding: 10px; }
    .slot-hdr { display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .titular { font-weight: 600; }
    .meta { color: #6b7280; font-size: 12px; }
    .cand-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .cand-btn { text-transform: none; }
    .muted { color: #6b7280; }
    .footer { padding: 8px 0 0; display:flex; justify-content:flex-end; gap:8px; }
    h2 small.muted { font-weight: 400; font-size: 12px; margin-left: 6px; }
  `]
})
export class AgendaSemanalDialogComponent implements OnInit {
  loading = true;
  agenda?: AgendaSemanaDTO;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { domingoBaseISO: string; modoLibre?: boolean; titularId?: number },
    private ref: MatDialogRef<AgendaSemanalDialogComponent>,
    private svc: IncidenciasY2AdminService
  ) { }

  ngOnInit(): void {
    const src$ = this.data.modoLibre && this.data.titularId
      ? this.svc.getAgendaLibre(this.data.domingoBaseISO, this.data.titularId, true)
      : this.svc.getAgenda(this.data.domingoBaseISO);

    src$.subscribe({
      next: (a) => { this.agenda = a; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  holdAndPrepare(slot: AgendaSlotDTO, c: any) {
    // MODO LIBRE: aplica directo (no requiere incidencia ni hold)
    if (this.data.modoLibre) {
      const horas = slot.franja === 'DIA_COMPLETO' ? 8 : 4;
      this.svc.aplicarDirecto({
        titularId: slot.titularId,
        reemplazoId: c.id,
        fecha: slot.fecha,
        turno: slot.turno,
        franja: slot.franja,
        horas,
        modalidad: horas === 8 ? 'COMPLETO' : 'FRACCIONADO'
      }).subscribe({
        next: () => this.ref.close({ _applied: true }),
        error: (e) => { console.error(e); }
      });
      return;
    }

    // MODO NORMAL: crea hold + devuelve request al padre
    const req: CrearHoldRequest = {
      incidenciaId: slot.incidenciaId,
      reemplazoId: c.id,
      fecha: slot.fecha,
      turno: slot.turno,
      franja: slot.franja,
      ttlMin: 10,
      createdBy: 'admin-ui'
    };

    this.svc.crearHold(req).subscribe({
      next: (hold: HoldDTO) => {
        this.ref.close({
          incidenciaId: slot.incidenciaId,
          reemplazoId: c.id,
          turno: slot.turno,
          franja: slot.franja,
          horas: slot.franja === 'DIA_COMPLETO' ? 8 : 4,
          modalidad: slot.franja === 'DIA_COMPLETO' ? 'COMPLETO' : 'FRACCIONADO',
          _holdId: hold.id
        });
      },
      error: (e) => { console.error(e); }
    });
  }

  close() { this.ref.close(); }
}
