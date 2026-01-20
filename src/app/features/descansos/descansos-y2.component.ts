import { Component, OnInit, ViewEncapsulation, HostBinding, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, firstValueFrom } from 'rxjs';
import { RouterModule } from '@angular/router';

// Material
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

// App
import { ExcelExportService } from 'src/app/core/services/excel-export.service';
import { DescansosY2Service, Y2GenModo } from 'src/app/core/services/descansos-y2.service';
import { DescansoY2, ReemplazoY2, IncidenciaY2 } from 'src/app/core/models/descanso-y2.model';
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { IfRolesDirective } from 'src/app/shared/directives/if-roles.directive';
import { ConfirmDialogComponent } from 'src/app/features/programacion/dialogs/confirm-dialog.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { DescansosY1Service } from 'src/app/core/services/descansos-y1.service';

type ISODate = string;

interface CalendarCol { label: string; iso: ISODate; } // L..S
interface CellGroup {
  key: string; puesto: string; maquina: string; turno: string;
  franja: string; horas: number; colaboradores: string[];
}
interface CalendarCell { groups: CellGroup[]; }
/** 👇 ahora con flag isAutoOnly para ordenar al final */
interface CalendarRow { reemplazo: string; cells: Record<ISODate, CalendarCell>; isAutoOnly?: boolean; }

type Density = 'comfortable' | 'compact' | 'ultra';

@Component({
  selector: 'app-descansos-y2',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    // Material
    MatButtonModule, MatIconModule, MatSnackBarModule, MatProgressBarModule,
    MatFormFieldModule, MatInputModule, MatDialogModule, MatButtonToggleModule,
    MatDatepickerModule, MatNativeDateModule, MatProgressSpinnerModule,
    MatCheckboxModule,
    // UI
    PageHeaderComponent, IfRolesDirective, RouterModule,
  ],
  templateUrl: './descansos-y2.component.html',
  styleUrls: ['./descansos-y2.component.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'descansos-y2-page' }
})
export class DescansosY2Component implements OnInit {
  private svc = inject(DescansosY2Service);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private auth = inject(AuthService);
  private excel = inject(ExcelExportService);
  private y1 = inject(DescansosY1Service);
  private overlayY1Busy = new Map<string, Set<ISODate>>();
  private y2Assigned = new Map<ISODate, Set<string>>();


  reemplazos: ReemplazoY2[] = [];
  descansos: DescansoY2[] = [];
  incidencias: IncidenciaY2[] = [];

  calendarCols: CalendarCol[] = [];
  calendarRows: CalendarRow[] = [];

  loading = true;               // carga de datos de la página
  fullscreenLoading = false;    // overlay para generar/eliminar "todo"

  domingoActual!: string; // 'YYYY-MM-DD' (semana visible en la tabla)
  habilitaAnterior = false;
  habilitaSiguiente = false;


  // Estados de carga por botón de generación parcial
  genLoading: Record<Y2GenModo, boolean> = {
    NOCHE: false, MANANA: false, TARDE: false,
    TURNO_FIJO: false, GRUPO_Y2: false, GRUPO_Y1: false
  };

  // Filtros
  filtroReemplazo = '';
  filtroNombre = '';
  resumenColaboradores: any[] = [];

  // Densidad UI
  density: Density = (localStorage.getItem('descansos.y2.density') as Density) || 'comfortable';
  @HostBinding('class.density-compact') get _isCompact() { return this.density === 'compact'; }
  @HostBinding('class.density-ultra') get _isUltra() { return this.density === 'ultra'; }
  setDensity(d: Density) { this.density = d; localStorage.setItem('descansos.y2.density', d); }

  // ===== Header =====
  get subtitle(): string {
    const d0 = this.parseIsoDateLocal(this.domingoActual);
    const d1 = new Date(d0); d1.setDate(d0.getDate() + 1); // Lunes
    const d6 = new Date(d0); d6.setDate(d0.getDate() + 6); // Sábado
    const fmt = "d 'de' MMMM 'de' y";
    const ini = formatDate(d1, fmt, 'es-CO');
    const fin = formatDate(d6, fmt, 'es-CO');
    return `Semana del ${ini} al ${fin}`;
  }

  // ===== Ciclo de vida =====
  ngOnInit(): void {
    // Base = domingo actual (medianoche local)
    const now = new Date();
    const local = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = local.getDay(); // 0=Dom
    const sunday = new Date(local);
    sunday.setDate(local.getDate() - dow);
    this.domingoActual = this.toIsoLocal(sunday);

    this.buildWeekFromDomingo(this.domingoActual);
    this.cargar(this.domingoActual);
    this.refrescarBotones(this.domingoActual);
  }

  // ===== Fechas =====
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
    const labels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    this.calendarCols = Array.from({ length: 6 }).map((_, i) => {
      const f = new Date(domingo);
      f.setDate(domingo.getDate() + (i + 1)); // +1 => lunes
      return { label: labels[i], iso: this.toIsoLocal(f) };
    });
  }
  isToday(iso: ISODate): boolean {
    return this.toIsoLocal(new Date()) === iso;
  }

  // ===== Datos =====
  cargar(domingo?: string) {
    this.loading = true;

    forkJoin({
      reemplazos: this.svc.getReemplazos(domingo),
      descansos: this.svc.getDescansos(domingo),
      incidencias: this.svc.getIncidencias(domingo),
      resumen: this.svc.getResumenColaboradores(domingo),
      // ↓ NUEVO: traemos los Y1 para saber en qué días están ocupados como reemplazo
      y1Descansos: this.y1.getDescansos(domingo)
    }).subscribe({
      next: ({ reemplazos, descansos, incidencias, resumen, y1Descansos }) => {
        this.reemplazos = reemplazos;
        this.descansos = descansos;
        this.incidencias = incidencias || [];
        this.resumenColaboradores = resumen;

        // ---- construir overlay “Compensatorio” (Y1 ocupado) ----
       /* this.overlayY1Busy.clear();
        for (const d of y1Descansos || []) {
          const nombreY1 = (d.reemplazo || '').trim();   // persona del grupo Y1 que hizo el reemplazo
          const iso = d.fechaDescanso;                    // ISO del día
          if (!nombreY1) continue;
          if (!this.overlayY1Busy.has(nombreY1)) this.overlayY1Busy.set(nombreY1, new Set());
          this.overlayY1Busy.get(nombreY1)!.add(iso);
        }*/
        this.overlayY1Busy.clear();
        for (const d of y1Descansos || []) {
          const raw = (d.reemplazo || '').trim();          // Y1 que hizo el reemplazo
          if (!raw || raw === '—') continue;               // evita placeholder
          const key = this.norm(raw);                      // 🔧 normaliza aquí
          const iso = d.fechaDescanso;
          if (!this.overlayY1Busy.has(key)) this.overlayY1Busy.set(key, new Set());
          this.overlayY1Busy.get(key)!.add(iso);
        }

         // ---- índice de Y2 por día/persona ----
        this.y2Assigned.clear();
        for (const d of this.descansos || []) {
          const iso = d.fechaReduccion;
          const who = this.norm(d.colaborador);
          if (!iso || !who) continue;
          if (!this.y2Assigned.has(iso)) this.y2Assigned.set(iso, new Set());
          this.y2Assigned.get(iso)!.add(who);
        }

        this.buildCalendar();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snack.open('⚠️ Error cargando Y2', 'OK', { duration: 3000 });
      }
    });
  }

  // Helper para el template
  isY1Ocupado(nombreFila: string, iso: ISODate): boolean {
    const key = this.norm(nombreFila); 
    /*return this.overlayY1Busy.get((nombreFila || '').trim())?.has(iso) ?? false;*/
    return this.overlayY1Busy.get(key)?.has(iso) ?? false;
  }

  /** Construye el calendario y deja las filas AUTO-ONLY al final (antes de "— Sin asignar"). */
  private buildCalendar() {
    const rowsMap = new Map<string, CalendarRow>();
    const colKeys = new Set(this.calendarCols.map(c => c.iso));
    const SIN = '— Sin asignar';

    // 0) Flags por fila para detectar AUTO-ONLY
    const rowFlags = new Map<string, { hasAuto: boolean; hasNonAuto: boolean }>();
    for (const d of this.descansos) {
      const rowKey = d.reemplazo && d.reemplazo.trim() !== '—' ? d.reemplazo.trim() : SIN;
      const auto = (d.modalidad || '').toUpperCase().includes('AUTO'); // AUTOREEMPLAZO / AUTO_Y2
      const rec = rowFlags.get(rowKey) || { hasAuto: false, hasNonAuto: false };
      if (auto) rec.hasAuto = true; else rec.hasNonAuto = true;
      rowFlags.set(rowKey, rec);
    }

    // 1) Presembrar filas desde "reemplazos" con su flag isAutoOnly
    for (const r of this.reemplazos) {
      const key = (r.reemplazo?.trim() || SIN);
      if (!rowsMap.has(key)) {
        const flags = rowFlags.get(key) || { hasAuto: false, hasNonAuto: false };
        rowsMap.set(key, { reemplazo: key, cells: {}, isAutoOnly: flags.hasAuto && !flags.hasNonAuto });
      }
    }

    // 2) Poblar celdas (L..S) y crear filas faltantes, respetando isAutoOnly
    for (const d of this.descansos) {
      const iso = d.fechaReduccion;
      if (!colKeys.has(iso)) continue;

      const rowKey = d.reemplazo && d.reemplazo.trim() !== '—' ? d.reemplazo.trim() : SIN;
      if (!rowsMap.has(rowKey)) {
        const flags = rowFlags.get(rowKey) || { hasAuto: false, hasNonAuto: false };
        rowsMap.set(rowKey, { reemplazo: rowKey, cells: {}, isAutoOnly: flags.hasAuto && !flags.hasNonAuto });
      }

      const row = rowsMap.get(rowKey)!;
      if (!row.cells[iso]) row.cells[iso] = { groups: [] };

      const puesto = d.puesto || 'SIN PUESTO';
      const maquina = d.maquina || 'SIN MAQUINA';
      const turno = d.turno || 'SIN TURNO';
      const franja = d.franja || '';
      const horas = d.horas || 0;

      const gkey = `${(puesto || '').toUpperCase()}|${(maquina || '').toUpperCase()}|${(turno || '').toUpperCase()}|${(franja || '').toUpperCase()}|${horas}`;
      let group = row.cells[iso].groups.find(g => g.key === gkey);
      if (!group) {
        group = { key: gkey, puesto, maquina, turno, franja, horas, colaboradores: [] };
        row.cells[iso].groups.push(group);
      }
      if (d.colaborador) group.colaboradores.push(d.colaborador);
    }

    // 3) Ordenar grupos
    const rankFranja = (f: string) => {
      const order = ['6-10', '10-14', '14-18', '18-22', 'DIA_COMPLETO', 'PARCIAL_2H'];
      const idx = order.indexOf((f || '').toUpperCase());
      return idx === -1 ? 99 : idx;
    };

    for (const row of rowsMap.values()) {
      for (const iso of Object.keys(row.cells)) {
        const cell = row.cells[iso];
        cell.groups.sort((a, b) =>
          (a.puesto || '').localeCompare(b.puesto || '') ||
          (a.maquina || '').localeCompare(b.maquina || '') ||
          (a.turno || '').localeCompare(b.turno || '') ||
          (rankFranja(a.franja) - rankFranja(b.franja)) ||
          (a.horas - b.horas)
        );
        for (const g of cell.groups) g.colaboradores.sort((a, b) => a.localeCompare(b));
      }
    }

    // 4) Salida ordenada: 0) Reemplazos reales 1) AUTO-ONLY 2) "— Sin asignar"
    const rowRank = (row: CalendarRow) => {
      if (row.reemplazo === SIN) return 2;
      return row.isAutoOnly ? 1 : 0;
    };

    this.calendarRows = Array.from(rowsMap.values()).sort((a, b) =>
      rowRank(a) - rowRank(b) || a.reemplazo.localeCompare(b.reemplazo)
    );
  }

  // Agrupar visualmente por turno
  turnoBuckets(cell: CalendarCell | undefined): { turno: string; items: CellGroup[] }[] {
    if (!cell) return [];
    const map = new Map<string, CellGroup[]>();
    const rankFranja = (f: string) => {
      const order = ['6-10', '10-14', '14-18', '18-22', 'DIA_COMPLETO', 'PARCIAL_2H'];
      const idx = order.indexOf((f || '').toUpperCase());
      return idx === -1 ? 99 : idx;
    };
    for (const g of cell.groups) {
      const key = g.turno || 'SIN TURNO';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(g);
    }
    const out = Array.from(map.entries()).map(([turno, items]) => ({
      turno,
      items: items.sort((a, b) =>
        (rankFranja(a.franja) - rankFranja(b.franja)) ||
        (a.horas - b.horas) ||
        (a.puesto || '').localeCompare(b.puesto || '') ||
        (a.maquina || '').localeCompare(b.maquina || '')
      )
    }));
    return out.sort((a, b) => (a.turno || '').localeCompare(b.turno || ''));
  }

  // ===== Navegación =====
  refrescarBotones(desde: string) {
    this.svc.getDomingoAnterior(desde).subscribe({ next: d => this.habilitaAnterior = !!d, error: () => this.habilitaAnterior = false });
    this.svc.getDomingoSiguiente(desde).subscribe({ next: d => this.habilitaSiguiente = !!d, error: () => this.habilitaSiguiente = false });
  }
  irAnterior() {
    this.svc.getDomingoAnterior(this.domingoActual).subscribe(d => {
      if (d) { this.domingoActual = d; this.buildWeekFromDomingo(d); this.cargar(d); this.refrescarBotones(d); }
    });
  }
  irSiguiente() {
    this.svc.getDomingoSiguiente(this.domingoActual).subscribe(d => {
      if (d) { this.domingoActual = d; this.buildWeekFromDomingo(d); this.cargar(d); this.refrescarBotones(d); }
    });
  }

  // ===== Acciones (ADMIN) =====
  private abrirConfirm(message: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Confirmación', message, confirmText: 'Confirmar', cancelText: 'Cancelar' }
    });
    return firstValueFrom(ref.afterClosed());
  }

  async generar() {
    if (!this.auth.hasRole('ADMIN', 'SUPERVISOR')) { this.snack.open('No autorizado (solo SUPERVISOR/ADMIN).', 'OK', { duration: 2500 }); return; }
    const ok = await this.abrirConfirm('¿Generar reducciones Y2 para la semana seleccionada (modo completo)?');
    if (!ok) return;

    this.fullscreenLoading = true;
    this.svc.generar(this.domingoActual).subscribe({
      next: () => { this.snack.open('✅ Reducciones generadas.', 'OK', { duration: 2500 }); this.cargar(this.domingoActual); },
      error: err => this.snack.open('Error al generar: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => this.fullscreenLoading = false);
  }

  async eliminar() {
    if (!this.auth.hasRole('SUPERVISOR', 'ADMIN')) { this.snack.open('No autorizado (solo SUPERVISOR/ADMIN).', 'OK', { duration: 2500 }); return; }
    const ok = await this.abrirConfirm('⚠️ Esto eliminará la semana completa de reducciones Y2. ¿Continuar?');
    if (!ok) return;

    this.fullscreenLoading = true;
    this.svc.eliminar(this.domingoActual).subscribe({
      next: () => { this.snack.open('🗑️ Semana Y2 eliminada.', 'OK', { duration: 2500 }); this.cargar(this.domingoActual); },
      error: err => this.snack.open('Error al eliminar: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => this.fullscreenLoading = false);
  }

  // ===== Generación por partes =====
  private modoLabel(m: Y2GenModo): string {
    switch (m) {
      case 'NOCHE': return 'los que vienen de NOCHE (8h)';
      case 'MANANA': return 'turno MAÑANA';
      case 'TARDE': return 'turno TARDE';
      case 'TURNO_FIJO': return 'turno FIJO (2h + 2h)';
      case 'GRUPO_Y2': return 'grupo Y2';
      case 'GRUPO_Y1': return 'grupo Y1';
    }
  }

  async run(modo: Y2GenModo) {
    if (!this.auth.hasRole('SUPERVISOR', 'ADMIN')) {
      this.snack.open('No autorizado (solo SUPERVISOR/ADMIN).', 'OK', { duration: 2500 });
      return;
    }

    const label = this.modoLabel(modo);
    const ok = await this.abrirConfirm(`¿Generar reducciones SOLO para ${label} en la semana visible (domingo base ${this.domingoActual})?`);
    if (!ok) return;

    this.genLoading[modo] = true;
    this.svc.generarPorModo(modo, this.domingoActual).subscribe({
      next: () => {
        this.snack.open(`✅ Generación parcial completada: ${label} (base ${this.domingoActual}).`, 'OK', { duration: 2500 });
        // ya estás en esa semana, solo recarga
        this.cargar(this.domingoActual);
      },
      error: err => {
        const msg = err?.error || err?.message || 'desconocido';
        this.snack.open(`Error al generar (${label}): ${msg}`, 'OK', { duration: 4000 });
      }
    }).add(() => this.genLoading[modo] = false);
  }


  // ===== Filtros / trackBy =====
  filteredRows(): CalendarRow[] {
    const fr = this.filtroReemplazo.trim().toLowerCase();
    const fn = this.filtroNombre.trim().toLowerCase();
    return this.calendarRows.filter(row => {
      const okRow = !fr || row.reemplazo.toLowerCase().includes(fr);
      if (!okRow) return false;
      if (!fn) return true;
      for (const iso of Object.keys(row.cells)) {
        const cell = row.cells[iso];
        for (const g of cell.groups) {
          if (g.colaboradores.some(n => n.toLowerCase().includes(fn))) return true;
        }
      }
      return false;
    });
  }

  // helper para normalizar nombres (tildes, mayúsculas y espacios)
private norm(s?: string | null): string {
  return (s || '')
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toUpperCase();
}


  exportarExcel(): void {
  const rows = this.filteredRows();

  this.excel.exportY2({
    titulo: 'Reducciones',
    subtitulo: this.subtitle,
    cols: this.calendarCols,
    rows,
    incidencias: this.incidencias,
    filename: `Reducciones_${this.domingoActual}.xlsx`,
    // 👇 usa el mismo overlay que pintas en la tabla
      isComp: (iso, nombre) => {
    const key = this.norm(nombre);
    const busy = this.overlayY1Busy.get(key)?.has(iso) ?? false;
    const hasY2 = this.y2Assigned.get(iso)?.has(key) ?? false;
    return busy && !hasY2;   // 👈 evita marcar si esa persona tiene Y2 ese día
  }
});
}


  // En la clase:
  dayMap: Record<string, string> = {
    MONDAY: 'Lun', TUESDAY: 'Mar', WEDNESDAY: 'Mié', THURSDAY: 'Jue', FRIDAY: 'Vie', SATURDAY: 'Sáb'
  };

  diasPermitidos: Array<{ key: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY', label: string }> = [
    { key: 'MONDAY', label: 'Lunes' },
    { key: 'TUESDAY', label: 'Martes' },
    { key: 'WEDNESDAY', label: 'Miércoles' },
    { key: 'THURSDAY', label: 'Jueves' },
    { key: 'FRIDAY', label: 'Viernes' },
    { key: 'SATURDAY', label: 'Sábado' },
  ];

  mostrarEditarSeed = false;             // si prefieres un mini diálogo inline
  seedEditModel: { id?: number; day?: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY'; forzar?: true } = {};

  abrirEditarSeed(r: any) {
    if (!this.auth.hasRole('ADMIN', 'SUPERVISOR')) {
      this.snack.open('No autorizado (solo SUPERVISOR/ADMIN).', 'OK', { duration: 2500 });
      return;
    }
    this.mostrarEditarSeed = true;
    this.seedEditModel = {
      id: r.colaboradorId,
      day: (r.y2UltimoDiaDescanso as any) || 'MONDAY',
      forzar: true, // 👈 siempre forzado
    };
  }

  guardarSeed() {
    const { id, day } = this.seedEditModel;
    if (!id || !day) { this.snack.open('Selecciona un día válido.', 'OK', { duration: 2500 }); return; }

    // 👇 envía siempre forzar: true
    this.svc.setRotacionSeed({ colaboradorId: id, ultimoDia: day, forzar: true }).subscribe({
      next: () => {
        this.snack.open('✅ Semilla de rotación (forzada) actualizada.', 'OK', { duration: 2200 });
        this.mostrarEditarSeed = false;
        this.cargar(this.domingoActual);
      },
      error: err => {
        const msg = err?.error || err?.message || 'desconocido';
        this.snack.open('Error al guardar seed: ' + msg, 'OK', { duration: 4000 });
      }
    });
  }


  trackByCol = (_: number, c: CalendarCol) => c.iso;
  trackByRow = (_: number, r: CalendarRow) => r.reemplazo;

  // ===== KPIs de incidencias =====
  get incTotal(): number { return this.incidencias?.length || 0; }
}
