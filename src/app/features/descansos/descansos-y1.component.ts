import { Component, OnInit, ViewEncapsulation, HostBinding, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';

// Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

// App
import { ExcelExportService } from 'src/app/core/services/excel-export.service';
import { DescansosY1Service } from 'src/app/core/services/descansos-y1.service';
import { TrabajadorDomingo, ReemplazoY1, DescansoY1 } from 'src/app/core/models/descanso-y1.model';
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { IfRolesDirective } from 'src/app/shared/directives/if-roles.directive';
import { ConfirmDialogComponent } from '../programacion/dialogs/confirm-dialog.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { DescansosY2Service } from 'src/app/core/services/descansos-y2.service';

type ISODate = string;

interface CalendarCol { label: string; iso: ISODate; }
interface CellGroup { key: string; puesto: string; maquina: string; turno: string; colaboradores: string[]; }
interface CalendarCell { groups: CellGroup[]; }
interface CalendarRow { reemplazo: string; cells: Record<ISODate, CalendarCell>; }

type Density = 'comfortable' | 'compact' | 'ultra';

@Component({
  selector: 'app-descansos-y1',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    // Material
    MatButtonModule, MatIconModule, MatSnackBarModule, MatProgressBarModule,
    MatFormFieldModule, MatInputModule, MatDialogModule, MatButtonToggleModule,
    // UI
    PageHeaderComponent, IfRolesDirective
  ],
  templateUrl: './descansos-y1.component.html',
  styleUrls: ['./descansos-y1.component.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'descansos-y1-page' }
})
export class DescansosY1Component implements OnInit {
  private svc = inject(DescansosY1Service);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private auth = inject(AuthService);
  private excel = inject(ExcelExportService);
  private y2 = inject(DescansosY2Service);
  private overlayY2Reduc = new Map<string, Set<ISODate>>();

  trabajadores: TrabajadorDomingo[] = [];
  reemplazos: ReemplazoY1[] = [];
  descansos: DescansoY1[] = [];

  calendarCols: CalendarCol[] = [];
  calendarRows: CalendarRow[] = [];

  loading = true;
  fullscreenLoading = false;

  domingoActual!: string; // 'YYYY-MM-DD'
  habilitaAnterior = false;
  habilitaSiguiente = false;

  // Filtros
  filtroReemplazo = '';
  filtroNombre = '';

  // Densidad UI
  density: Density = (localStorage.getItem('descansos.density') as Density) || 'comfortable';
  @HostBinding('class.density-compact') get _isCompact() { return this.density === 'compact'; }
  @HostBinding('class.density-ultra') get _isUltra() { return this.density === 'ultra'; }
  setDensity(d: Density) { this.density = d; localStorage.setItem('descansos.density', d); }

  ngOnInit(): void {
    // Medianoche local
    const now = new Date();
    const todayLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = todayLocalMidnight.getDay(); // 0=domingo
    const sunday = new Date(todayLocalMidnight);
    sunday.setDate(todayLocalMidnight.getDate() - dow);
    this.domingoActual = this.toIsoLocal(sunday);

    this.buildWeekFromDomingo(this.domingoActual);
    this.cargarDatos(this.domingoActual);
    this.refrescarBotones(this.domingoActual);
  }

  // ===== Header =====
  get subtitle(): string {
    const d0 = this.parseIsoDateLocal(this.domingoActual);
    const d6 = new Date(d0); d6.setDate(d0.getDate() + 6);
    const fmt = "d 'de' MMMM 'de' y";
    const ini = formatDate(d0, fmt, 'es-CO');
    const fin = formatDate(d6, fmt, 'es-CO');
    return `Semana del ${ini} al ${fin}`;
  }

  // ===== Helpers de fecha =====
  private toIsoLocal(date: Date): ISODate {
    const tz = date.getTimezoneOffset();
    const d = new Date(date.getTime() - tz * 60000);
    return d.toISOString().slice(0, 10);
  }
  private parseIsoDateLocal(iso: ISODate): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  private buildWeekFromDomingo(domingoISO: ISODate) {
    const domingo = this.parseIsoDateLocal(domingoISO);
    const labels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    this.calendarCols = Array.from({ length: 7 }).map((_, i) => {
      const f = new Date(domingo);
      f.setDate(domingo.getDate() + i);
      return { label: labels[i], iso: this.toIsoLocal(f) };
    });
  }
  isToday(iso: ISODate): boolean {
    const t = this.toIsoLocal(new Date());
    return t === iso;
  }
  // helper para normalizar nombres (tildes, mayúsculas y espacios)
  private norm(s?: string | null): string {
    return (s || '')
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toUpperCase();
  }


  cargarDatos(domingo?: string): void {
    this.loading = true;
    forkJoin({
      trabajadores: this.svc.getTrabajadores(domingo),
      reemplazos: this.svc.getReemplazos(domingo),
      descansos: this.svc.getDescansos(domingo),
      y2: this.y2.getDescansos(domingo)
    }).subscribe({
      next: ({ trabajadores, reemplazos, descansos, y2 }) => {
        this.trabajadores = trabajadores;
        this.reemplazos = reemplazos;
        this.descansos = descansos;

        this.overlayY2Reduc.clear();
        for (const d of y2 || []) {
          const modalidad = (d.modalidad || '').toUpperCase();
          const iso = d.fechaReduccion;

          // No-AUTO => marcar al reemplazo (persona del grupo Y1 que ocupó) se hizo cambio antes if (modalidad.includes('AUTO')) continue; // no ocupa a nadie

          const key = modalidad.includes('AUTO')
            ? this.norm(d.colaborador)
            : this.norm(d.reemplazo);

          if (!key || key === '—') continue;

          if (!this.overlayY2Reduc.has(key)) {
            this.overlayY2Reduc.set(key, new Set<ISODate>());
          }
          this.overlayY2Reduc.get(key)!.add(iso);
        }

                this.buildCalendar();
                this.loading = false;
              },
              error: () => { this.loading = false; }
            });
          }

  // y el helper del template usa norm:
  tieneReduccion(nombreFila: string, iso: ISODate): boolean {
    return this.overlayY2Reduc.get(this.norm(nombreFila))?.has(iso) ?? false;
  }


  private buildCalendar() {
    const rowsMap = new Map<string, CalendarRow>();
    const colKeys = new Set(this.calendarCols.map(c => c.iso));
    const SIN_ASIGNAR_KEY = '— Sin asignar';
    const y1Name = (r: ReemplazoY1) => (r.reemplazo?.trim() || '—');

    // Presembrar filas para todos los Y1
    const seeded = new Set<string>();
    for (const r of this.reemplazos) {
      const nombre = y1Name(r);
      const key = nombre !== '—' ? nombre : SIN_ASIGNAR_KEY;
      if (!seeded.has(key)) {
        seeded.add(key);
        rowsMap.set(key, { reemplazo: key, cells: {} });
      }
    }

    // Poblar celdas con descansos
    for (const d of this.descansos) {
      const iso = d.fechaDescanso;
      if (!colKeys.has(iso)) continue;

      const rowKey = d.reemplazo && d.reemplazo.trim() !== '—'
        ? d.reemplazo.trim()
        : SIN_ASIGNAR_KEY;

      if (!rowsMap.has(rowKey)) rowsMap.set(rowKey, { reemplazo: rowKey, cells: {} });
      const row = rowsMap.get(rowKey)!;
      if (!row.cells[iso]) row.cells[iso] = { groups: [] };

      const puesto = d.puesto || 'SIN PUESTO';
      const maquina = d.maquina || 'SIN MAQUINA';
      const turno = d.turno || 'SIN TURNO';

      const groupKey = `${puesto.toUpperCase()}|${maquina.toUpperCase()}|${turno.toUpperCase()}`;
      let group = row.cells[iso].groups.find(g => g.key === groupKey);
      if (!group) {
        group = { key: groupKey, puesto, maquina, turno, colaboradores: [] };
        row.cells[iso].groups.push(group);
      }
      group.colaboradores.push(d.colaborador);
    }

    // Ordenar grupos y nombres
    for (const row of rowsMap.values()) {
      for (const iso of Object.keys(row.cells)) {
        const cell = row.cells[iso];
        cell.groups.sort((a, b) =>
          (a.puesto || '').localeCompare(b.puesto || '') ||
          (a.maquina || '').localeCompare(b.maquina || '') ||
          (a.turno || '').localeCompare(b.turno || '')
        );
        for (const g of cell.groups) g.colaboradores.sort((a, b) => a.localeCompare(b));
      }
    }

    // Filas: alfabético, "— Sin asignar" al final
    this.calendarRows = Array.from(rowsMap.values()).sort((a, b) => {
      const A = a.reemplazo === SIN_ASIGNAR_KEY, B = b.reemplazo === SIN_ASIGNAR_KEY;
      if (A && !B) return 1;
      if (!A && B) return -1;
      return a.reemplazo.localeCompare(b.reemplazo);
    });
  }

  // ===== Navegación de semana =====
  refrescarBotones(desde: string): void {
    this.svc.getDomingoAnterior(desde).subscribe({ next: d => this.habilitaAnterior = !!d, error: () => this.habilitaAnterior = false });
    this.svc.getDomingoSiguiente(desde).subscribe({ next: d => this.habilitaSiguiente = !!d, error: () => this.habilitaSiguiente = false });
  }
  irAnterior(): void {
    this.svc.getDomingoAnterior(this.domingoActual).subscribe(d => {
      if (d) { this.domingoActual = d; this.buildWeekFromDomingo(d); this.cargarDatos(d); this.refrescarBotones(d); }
    });
  }
  irSiguiente(): void {
    this.svc.getDomingoSiguiente(this.domingoActual).subscribe(d => {
      if (d) { this.domingoActual = d; this.buildWeekFromDomingo(d); this.cargarDatos(d); this.refrescarBotones(d); }
    });
  }

  // ===== Acciones (control por rol) =====
  async generarDescansos(): Promise<void> {
    if (!this.auth.hasRole('SUPERVISOR', 'ADMIN')) { this.snack.open('No autorizado (solo ADMIN).', 'OK', { duration: 2500 }); return; }
    const ok = await this.abrirConfirm('¿Generar descansos para la semana seleccionada?');
    if (!ok) return;

    this.fullscreenLoading = true;
    this.svc.generarDescansos(this.domingoActual).subscribe({
      next: () => { this.snack.open('✅ Descansos generados.', 'OK', { duration: 2500 }); this.cargarDatos(this.domingoActual); },
      error: err => this.snack.open('Error al generar: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => this.fullscreenLoading = false);
  }

  async eliminarDescansos(): Promise<void> {
    if (!this.auth.hasRole('SUPERVISOR', 'ADMIN')) { this.snack.open('No autorizado (solo ADMIN).', 'OK', { duration: 2500 }); return; }
    const ok = await this.abrirConfirm('⚠️ Esto eliminará todos los descansos de la semana. ¿Continuar?');
    if (!ok) return;

    this.fullscreenLoading = true;
    this.svc.eliminarDescansos(this.domingoActual).subscribe({
      next: () => { this.snack.open('🗑️ Descansos eliminados.', 'OK', { duration: 2500 }); this.cargarDatos(this.domingoActual); },
      error: err => this.snack.open('Error al eliminar: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => this.fullscreenLoading = false);
  }

  irAEdicionY1(): void {
    if (!this.auth.hasAnyRole(['SUPERVISOR', 'ADMIN'])) { this.snack.open('No autorizado.', 'OK', { duration: 2500 }); return; }
    this.router.navigate(['/descansos-y1/edicion']);
  }

  private abrirConfirm(message: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Confirmación', message, confirmText: 'Confirmar', cancelText: 'Cancelar' }
    });
    return firstValueFrom(ref.afterClosed());
  }

  // ===== Filtros / trackBy =====
  filteredRows(): CalendarRow[] {
    const fr = this.filtroReemplazo.trim().toLowerCase();
    const fn = this.filtroNombre.trim().toLowerCase();

    return this.calendarRows.filter(row => {
      const matchRow = !fr || row.reemplazo.toLowerCase().includes(fr);
      if (!matchRow) return false;
      if (!fn) return true;

      // debe existir al menos un colaborador que coincida en cualquier día
      for (const iso of Object.keys(row.cells)) {
        for (const g of row.cells[iso].groups) {
          if (g.colaboradores.some(n => n.toLowerCase().includes(fn))) return true;
        }
      }
      return false;
    });
  }


  exportarExcel(): void {
    const rows = this.filteredRows(); // respeta filtros UI
    this.excel.exportY1({
      titulo: 'Descansos compensatorios',
      subtitulo: this.subtitle,
      cols: this.calendarCols, // [{label, iso}]
      rows: rows,              // [{reemplazo, cells{iso:{groups:[...]}}}]
      filename: `Compensatorios_${this.domingoActual}.xlsx`,

        isReduc: (iso, nombre) => {
      const key = this.norm(nombre);
      return this.overlayY2Reduc.get(key)?.has(iso) ?? false;
    }
  });
    
  }

  trackByCol = (_: number, c: CalendarCol) => c.iso;
  trackByRow = (_: number, r: CalendarRow) => r.reemplazo;
}
