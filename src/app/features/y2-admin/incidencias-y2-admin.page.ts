import { Component, OnInit, ViewChild, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DatePipe } from '@angular/common';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { IncidenciasY2AdminService } from 'src/app/core/services/incidencias-y2-admin.service';
import {
  AplicarIncidenciaRequest,
  AplicacionResultDTO,
  IncidenciaY2DTO
} from 'src/app/core/models/incidencias-y2.models';
import { AgendaSemanalDialogComponent } from './partials/agenda-semanal.dialog';

@Component({
  selector: 'app-incidencias-y2-admin',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule, MatDialogModule, MatChipsModule, MatTooltipModule,
    MatSnackBarModule, MatCheckboxModule, MatProgressBarModule, DatePipe
  ],
  templateUrl: './incidencias-y2-admin.page.html',
  styleUrls: ['./incidencias-y2-admin.page.scss'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class IncidenciasY2AdminPage implements OnInit {

  private svc = inject(IncidenciasY2AdminService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  columnas: string[] = ['sel', 'fecha', 'colaborador', 'grupo', 'turno', 'franja', 'motivo', 'candidatos', 'acciones'];
  dataSource = new MatTableDataSource<IncidenciaY2DTO>([]);
  loading = signal(false);

  seleccionados = signal<Set<number>>(new Set()); // set de incidenciaId
  // mapa de solicitudes preparadas por fila para aplicar en lote:
  pendingRequests = signal<Map<number, AplicarIncidenciaRequest>>(new Map());

  filtro = this.fb.group({
    domingoBase: [this.computeTodaySunday()],
    buscar: ['']
  });

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  totalSeleccionados = computed(() => this.seleccionados().size);
  totalPreparados = computed(() => this.pendingRequests().size);

  ngOnInit() {
    this.cargarSemana();
    effect(() => {
      const term = this.filtro.get('buscar')!.value?.toLowerCase() || '';
      this.dataSource.filter = term;
    });
    this.dataSource.filterPredicate = (row, term) =>
      (row.colaboradorNombre?.toLowerCase().includes(term))
      || (row.motivo?.toLowerCase().includes(term))
      || (row.turno || '').toLowerCase().includes(term)
      || (row.franja || '').toLowerCase().includes(term);
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (row, col) => {
      switch (col) {
        case 'fecha': return row.fecha;
        case 'colaborador': return row.colaboradorNombre;
        default: return (row as any)[col];
      }
    };
  }

  computeTodaySunday(): Date {
    const today = new Date();
    const dow = today.getDay(); // 0 Sun..6 Sat
    const diff = dow === 0 ? 0 : dow; // ir atrás hasta domingo
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - diff);
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  }

  toISO(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  cargarSemana() {
    const base = this.filtro.get('domingoBase')!.value as Date;
    if (!base) return;
    this.loading.set(true);
    this.svc.getSemana(this.toISO(base), true).subscribe({
      next: (list) => {
        this.dataSource.data = list ?? [];
        this.seleccionados.set(new Set());
        this.pendingRequests.set(new Map());
        this.loading.set(false);
      },
      error: (e) => {
        this.loading.set(false);
        this.snack.open('Error cargando incidencias', 'Cerrar', { duration: 3000 });
        console.error(e);
      }
    });
  }

  toggleSeleccion(inc: IncidenciaY2DTO, checked: boolean) {
    const set = new Set(this.seleccionados());
    checked ? set.add(inc.id) : set.delete(inc.id);
    this.seleccionados.set(set);
  }

  limpiarSeleccion() {
    this.seleccionados.set(new Set());
    this.pendingRequests.set(new Map());
  }

  abrirDialogoCandidatos(inc: IncidenciaY2DTO) {
    const baseISO = this.toISO(this.filtro.get('domingoBase')!.value as Date);

    // Abrimos la AGENDA semanal (modo libre: permite aplicar en cualquier día de la semana)
    const ref = this.dialog.open(AgendaSemanalDialogComponent, {
      width: '1000px',
      data: {
        domingoBaseISO: baseISO,
        modoLibre: true,              // ← activa modo libre (L–S)
        titularId: inc.colaboradorId  // ← colaborador titular a evaluar
      },
      autoFocus: false
    });

    ref.afterClosed().subscribe((res?: any) => {
      if (!res) return;

      // Si se aplicó directamente (modo libre), recargamos la semana
      if (res._applied) {
        this.cargarSemana();
        this.snack.open('Asignación directa aplicada.', 'OK', { duration: 2500 });
        return;
      }

      // Caso normal: se preparó una solicitud con hold
      const applyReq: AplicarIncidenciaRequest = {
        incidenciaId: res.incidenciaId,
        reemplazoId: res.reemplazoId,
        turno: res.turno,
        franja: res.franja,
        horas: res.horas,
        modalidad: res.modalidad
      };

      const map = new Map(this.pendingRequests());
      map.set(res.incidenciaId, applyReq);
      this.pendingRequests.set(map);

      this.snack.open(
        'Candidato preparado (con hold). Puedes aplicar individualmente o en lote.',
        'OK',
        { duration: 2500 }
      );
    });
  }

  aplicarIndividual(inc: IncidenciaY2DTO) {
    const req = this.pendingRequests().get(inc.id);
    if (!req) {
      this.snack.open('Selecciona un candidato primero (icono de lupa).', 'Cerrar', { duration: 2500 });
      return;
    }
    this.loading.set(true);
    this.svc.aplicarUno(req).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.snack.open(res.mensaje || 'Aplicado', 'OK', { duration: 2500 });
        // refrescar lista
        this.cargarSemana();
      },
      error: (e) => {
        this.loading.set(false);
        this.snack.open('No se pudo aplicar la incidencia', 'Cerrar', { duration: 3000 });
        console.error(e);
      }
    });
  }

  aplicarLote() {
    const items = Array.from(this.pendingRequests().values());
    if (!items.length) {
      this.snack.open('No hay incidencias preparadas para lote.', 'Cerrar', { duration: 2500 });
      return;
    }
    this.loading.set(true);
    this.svc.aplicarLote(items).subscribe({
      next: (res: AplicacionResultDTO[]) => {
        this.loading.set(false);
        const ok = res.filter(r => r.aplicado).length;
        const fail = res.length - ok;
        this.snack.open(`Lote: ${ok} aplicadas, ${fail} fallidas`, 'OK', { duration: 3500 });
        this.cargarSemana();
      },
      error: (e) => {
        this.loading.set(false);
        this.snack.open('Error aplicando lote', 'Cerrar', { duration: 3000 });
        console.error(e);
      }
    });
  }

  prepararPorDefecto(inc: IncidenciaY2DTO, reemplazoId: number) {
    // Atajo para preparar una solicitud con valores por defecto si ya sabes el reemplazo
    const req: AplicarIncidenciaRequest = {
      incidenciaId: inc.id,
      reemplazoId,
      turno: inc.turno ?? undefined,
      franja: inc.franja ?? undefined,
      horas: inc.franja === 'DIA_COMPLETO' ? 8 : 4,
      modalidad: inc.franja === 'DIA_COMPLETO' ? 'COMPLETO' : 'FRACCIONADO'
    };
    const map = new Map(this.pendingRequests());
    map.set(inc.id, req);
    this.pendingRequests.set(map);
  }
}
