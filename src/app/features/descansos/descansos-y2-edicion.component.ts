import {
  Component, OnInit, ViewEncapsulation, inject, HostBinding, ChangeDetectionStrategy,
  ChangeDetectorRef, ViewChild, ViewChildren, TemplateRef, ElementRef, QueryList, AfterViewInit
} from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

// Material
import { MatDialog } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';

// CDK Drag & Drop
import {
  DragDropModule, CdkDragStart, CdkDragEnd, CdkDragDrop, CdkDropList
} from '@angular/cdk/drag-drop';

// App
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { IfRolesDirective } from 'src/app/shared/directives/if-roles.directive';
import { ConfirmDialogComponent } from 'src/app/features/programacion/dialogs/confirm-dialog.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { DescansosY2CrudService } from 'src/app/core/services/descansos-y2-crud.service';
import { DescansosY2Service } from 'src/app/core/services/descansos-y2.service';
import {
  Y2BacklogItemDTO, Y2DisponibilidadDTO, Y2SlotDTO, Y2OtorgarHorasRequest
} from 'src/app/core/models/descanso-y2-crud.model';
import { DescansoY2 } from 'src/app/core/models/descanso-y2.model';

type ISO = string;

interface CalendarCol { label: string; iso: ISO; }
interface CellGroup {
  key: string;
  puesto: string;
  maquina: string;
  turno: string;
  franja: string;
  horas: number;
  nombres: string[];
  ids: number[];
  empty?: boolean;
}
interface CalendarCell { groups: CellGroup[]; }

/** ✅ Fila con identidad del reemplazo (dueño del slot) */
interface CalendarRow {
  reemplazo: string;
  reemplazoId?: number | null;
  cells: Record<ISO, CalendarCell>;
  isAutoOnly?: boolean;
}

@Component({
  selector: 'app-descansos-y2-edicion',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    // Material
    MatButtonModule, MatIconModule, MatSnackBarModule, MatProgressBarModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatDatepickerModule, MatNativeDateModule, MatTableModule, MatTooltipModule,
    MatDialogModule, MatButtonToggleModule, MatMenuModule,
    // CDK
    DragDropModule,
    // UI
    PageHeaderComponent, IfRolesDirective
  ],
  templateUrl: './descansos-y2-edicion.component.html',
  styleUrls: ['./descansos-y2-edicion.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'y2-edicion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DescansosY2EdicionComponent implements OnInit, AfterViewInit {
  private crud = inject(DescansosY2CrudService);
  private svc = inject(DescansosY2Service);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);

  // ===== Dialog templates =====
  @ViewChild('crearDialog') crearDialog!: TemplateRef<any>;
  @ViewChild('editarDialog') editarDialog!: TemplateRef<any>;
  @ViewChild('swapDialog') swapDialog!: TemplateRef<any>;
  @ViewChild('tableScroll', { read: ElementRef }) tableScrollRef!: ElementRef<HTMLDivElement>;

  // Conectar todos los drop-lists
  @ViewChildren(CdkDropList) private dropLists!: QueryList<CdkDropList>;
  connectedLists: CdkDropList[] = [];
  allowEnter = () => true;

  // ===== Estado existente =====
  domingo!: ISO;
  backlog: Y2BacklogItemDTO[] = [];
  descansosSemana: DescansoY2[] = [];
  loading = true;
  working = false;
  disponiblesCrear: Y2DisponibilidadDTO[] = [];
  turnoCrear: string | null = null;
  colaboradoresList: { id: number; nombre: string }[] = [];
  descansosData: DescansoY2[] = [];

  // ===== Calendario =====
  calendarCols: CalendarCol[] = [];
  calendarRows: CalendarRow[] = [];
  selected?: DescansoY2 | null;
  selectedId?: number | null;

  // DnD / Menú contextual
  draggingId: number | null = null;
  menuActiveId: number | null = null;

  private readonly TURNOS = ['MAN', 'TAR'] as const;
  private readonly FRANJAS: Record<string, string[]> = {
    MAN: ['06:00-10:00', '10:00-14:00'],
    TAR: ['14:00-18:00', '18:00-22:00'],
  };

  // ===== Navegación / realce de columna =====
  private pendingScrollIso: ISO | null = null;

  // ===== Estado visual “Swap Dock” =====
  get hasA() { return !!this.swapA; }
  get hasB() { return !!this.swapB; }

  // Density
  density: 'comfortable' | 'compact' | 'ultra' =
    (localStorage.getItem('descansos.y2.edicion.density') as any) || 'comfortable';
  @HostBinding('class.density-compact') get _isCompact() { return this.density === 'compact'; }
  @HostBinding('class.density-ultra') get _isUltra() { return this.density === 'ultra'; }
  setDensity(d: any) { this.density = d; localStorage.setItem('descansos.y2.edicion.density', d); }

  // ===== Forms =====
  fCrear = this.fb.group({
    colaboradorId: [null as number | null, Validators.required],
    fecha: [null as Date | null, Validators.required],
    horas: [4, [Validators.required]],
    franja: [null as string | null],
    reemplazoId: [null as number | null],
    acumuladasPrevias: [true],
    forzar: [false]
  });

  fActualizar = this.fb.group({
    id: [null as number | null, Validators.required],
    nuevaFecha: [null as Date | null],
    horas: [null as number | null],
    franja: [null as string | null],
    reemplazoId: [null as number | null],
    forzar: [false]
  });

  fOtorgar = this.fb.group({
    colaboradorId: [null as number | null, Validators.required],
    horas: [4, [Validators.required, Validators.min(1)]],
    diferirASiguiente: [false]
  });

  // Swap
  swapA: DescansoY2 | null = null;
  swapB: DescansoY2 | null = null;
  forzarSwap = false;

  // ===== Helpers UI =====
  get subtitle(): string {
    const d0 = this.parseIso(this.domingo);
    const d1 = new Date(d0); d1.setDate(d0.getDate() + 1);
    const d6 = new Date(d0); d6.setDate(d0.getDate() + 6);
    const fmt = "d 'de' MMMM 'de' y";
    return `Semana del ${formatDate(d1, fmt, 'es-CO')} al ${formatDate(d6, fmt, 'es-CO')}`;
  }

  trackByBacklog = (_: number, b: Y2BacklogItemDTO) => b.colaboradorId;

  // ===== Ciclo de vida =====
  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap.get('domingo');
    this.domingo = qp || this.toIsoSunday(new Date());

    this.buildWeekCols(this.domingo);
    this.cargar();

    // Reglas horas/franja
    this.fCrear.get('horas')!.valueChanges.subscribe(h => {
      if (h === 8) this.fCrear.get('franja')!.setValue('DIA_COMPLETO');
      else if (this.fCrear.get('franja')!.value === 'DIA_COMPLETO') this.fCrear.get('franja')!.setValue(null);
    });
    this.fCrear.valueChanges.pipe(debounceTime(120)).subscribe(() => this.recalcDisponiblesCrear());

    this.fActualizar.get('horas')!.valueChanges.subscribe(h => {
      if (h === 8) this.fActualizar.get('franja')!.setValue('DIA_COMPLETO');
      else if (this.fActualizar.get('franja')!.value === 'DIA_COMPLETO') this.fActualizar.get('franja')!.setValue(null);
    });
  }

  ngAfterViewInit(): void {
    this.setupDnDConnections();
    this.dropLists.changes.subscribe(() => this.setupDnDConnections());
  }

  private setupDnDConnections(): void {
    this.connectedLists = this.dropLists?.toArray() ?? [];
    this.cdr.detectChanges();
  }

  // ===== Helpers normalización =====
  private canonTurno(raw?: string | null): 'MAN' | 'TAR' | 'SIN' {
    const v = (raw || '').toUpperCase();
    if (v === 'MAN' || v === '06:00-14:00') return 'MAN';
    if (v === 'TAR' || v === '14:00-22:00') return 'TAR';
    return 'SIN';
  }
  private canonTurnoFromFranja(f?: string | null): 'MAN' | 'TAR' | 'SIN' {
    const v = (f || '').toUpperCase();
    if (v === '06:00-10:00' || v === '10:00-14:00') return 'MAN';
    if (v === '14:00-18:00' || v === '18:00-22:00') return 'TAR';
    return 'SIN';
  }
  turnoBadge(t?: string | null): string {
    const v = (t || '').toUpperCase();
    if (v === 'MAN') return '06:00-14:00';
    if (v === 'TAR') return '14:00-22:00';
    return v || 'SIN TURNO';
  }
  diaSemanaES(d?: string | null): string {
    const m: Record<string, string> = {
      MONDAY: 'Lunes', TUESDAY: 'Martes', WEDNESDAY: 'Miércoles',
      THURSDAY: 'Jueves', FRIDAY: 'Viernes', SATURDAY: 'Sábado', SUNDAY: 'Domingo'
    };
    const key = (d || '').toUpperCase();
    return m[key] || (d || '—');
  }

  // ===== Carga de datos =====
  cargar() {
    this.loading = true;
    forkJoin({
      backlog: this.crud.getBacklog(this.domingo),
      descansos: this.svc.getDescansos(this.domingo)
    }).subscribe({
      next: ({ backlog, descansos }) => {
        this.backlog = backlog || [];
        this.descansosSemana = descansos || [];

        this.colaboradoresList = this.backlog
          .map(b => ({ id: b.colaboradorId, nombre: b.nombre }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));

        this.descansosData = this.descansosSemana.slice().sort((a, b) =>
          (a.fechaReduccion || '').localeCompare(b.fechaReduccion || '') ||
          (a.colaborador || '').localeCompare(b.colaborador || '')
        );

        this.buildCalendar();

        if (this.pendingScrollIso) {
          const iso = this.pendingScrollIso;
          setTimeout(() => this.scrollToIso(iso), 120);
          this.pendingScrollIso = null;
        }

        this.recalcDisponiblesCrear();

        this.loading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.snack.open('Error cargando edición Y2: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 });
        this.cdr.markForCheck();
      }
    });
  }

  // ===== Calendario =====
  private buildWeekCols(domingoISO: ISO) {
    const [y, m, d] = domingoISO.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    const labels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    this.calendarCols = Array.from({ length: 6 }).map((_, i) => {
      const f = new Date(base);
      f.setDate(base.getDate() + (i + 1));
      return { label: labels[i], iso: this.toIsoLocal(f) };
    });
  }

  /** Devuelve un map nombre→id para TODOS los que pueden ser dueños de fila (Y2 y Y1). */
private reemplazoNameIdMap(): Map<string, number> {
  const norm = (s: string) => (s || '').trim().toLowerCase();
  const m = new Map<string, number>();
  for (const b of this.backlog) {
    const g = (b.grupo || '').toUpperCase();
    const esY2 = g.includes('Y2');
    const esY1 = g.includes('Y1');
    if (esY2 || esY1) {
      m.set(norm(b.nombre), b.colaboradorId);
    }
  }
  return m;
}


  /** ✅ buildCalendar: garantiza filas para TODOS los Y2 y completa reemplazoId por nombre */
  private buildCalendar() {
    const colKeys = new Set(this.calendarCols.map(c => c.iso));
    const rowsMap = new Map<string, CalendarRow>();
    const SIN = '— Sin asignar';
    const repByName = this.reemplazoNameIdMap();           // ← mapa nombre→id para Y2/Y1
    const norm = (s: string) => (s || '').trim().toLowerCase();

    // 1) Flags por fila (solo de lo que viene en la semana)
    const rowFlags = new Map<string, { hasAuto: boolean; hasNonAuto: boolean }>();
    for (const d of this.descansosSemana) {
      const rowKey = d.reemplazo && d.reemplazo.trim() !== '—' ? d.reemplazo.trim() : SIN;
      const auto = (d.modalidad || '').toUpperCase() === 'AUTOREEMPLAZO';
      const rec = rowFlags.get(rowKey) || { hasAuto: false, hasNonAuto: false };
      if (auto) rec.hasAuto = true; else rec.hasNonAuto = true;
      rowFlags.set(rowKey, rec);
    }

    // 2) Inicializar filas existentes por data de la semana
    for (const d of this.descansosSemana) {
      const rowKey = d.reemplazo && d.reemplazo.trim() !== '—' ? d.reemplazo.trim() : SIN;
      if (!rowsMap.has(rowKey)) {
        const flags = rowFlags.get(rowKey) || { hasAuto: false, hasNonAuto: false };
        rowsMap.set(rowKey, { reemplazo: rowKey, reemplazoId: null, cells: {}, isAutoOnly: flags.hasAuto && !flags.hasNonAuto });
      }
      // Capturar reemplazoId si viene en DTO
      const maybeRepId = (d as any).reemplazoId as number | undefined;
      const row = rowsMap.get(rowKey)!;
      if (rowKey !== SIN) {
        if (maybeRepId && !row.reemplazoId) row.reemplazoId = maybeRepId;
        // 🚑 fallback por nombre si aún está vacío (ahora soporta Y1 y Y2)
      if (!row.reemplazoId) {
        const idByName = repByName.get(norm(rowKey));
        if (idByName) row.reemplazoId = idByName;
      }

      }
    }
    if (!rowsMap.size) rowsMap.set(SIN, { reemplazo: SIN, reemplazoId: null, cells: {}, isAutoOnly: false });

    // 3) **Añadir filas para TODOS los Y2** aunque no tengan registros en la semana
    for (const b of this.backlog) {
      if (!(b.grupo || '').toUpperCase().includes('Y2')) continue;
      const key = b.nombre?.trim() || '';
      if (!key) continue;
      if (!rowsMap.has(key)) {
        rowsMap.set(key, { reemplazo: key, reemplazoId: b.colaboradorId, cells: {}, isAutoOnly: false });
      } else {
        // Si existe pero sin reemplazoId, complétalo
        const row = rowsMap.get(key)!;
        if (!row.reemplazoId) row.reemplazoId = b.colaboradorId;
      }
    }

    // 4) Agrupar celdas
    for (const d of this.descansosSemana) {
      const iso = d.fechaReduccion!;
      if (!colKeys.has(iso)) continue;

      const rowKey = d.reemplazo && d.reemplazo.trim() !== '—' ? d.reemplazo.trim() : SIN;
      const row = rowsMap.get(rowKey)!;
      if (!row.cells[iso]) row.cells[iso] = { groups: [] };

      const puesto = d.puesto || '—';
      const maquina = d.maquina || '—';
      const franja = d.franja || '';
      const horas = d.horas || 0;

      let turnoCanon = this.canonTurno(d.turno);
      if (turnoCanon === 'SIN') turnoCanon = this.canonTurnoFromFranja(franja);

      const gkey = `${puesto}|${maquina}|${turnoCanon}|${franja}|${horas}`;
      let group = row.cells[iso].groups.find(g => g.key === gkey);
      if (!group) group = row.cells[iso].groups[row.cells[iso].groups.push({ key: gkey, puesto, maquina, turno: turnoCanon, franja, horas, nombres: [], ids: [] }) - 1];
      group.nombres.push(d.colaborador!);
      group.ids.push(d.id!);
    }

    // 5) Placeholders + orden
    for (const row of rowsMap.values()) {
      for (const col of this.calendarCols) {
        if (!row.cells[col.iso]) row.cells[col.iso] = { groups: [] };
        this.ensureSmartEmptySlots(row.cells[col.iso], !row.isAutoOnly);
      }
      for (const iso of Object.keys(row.cells)) {
        const cell = row.cells[iso];
        const rankFranja = (f: string) => {
          const order = ['06:00-10:00', '10:00-14:00', '14:00-18:00', '18:00-22:00', 'DIA_COMPLETO'];
          const idx = order.indexOf((f || '').toUpperCase());
          return idx === -1 ? 99 : idx;
        };
        const rankTurno = (t: string) => (t === 'MAN' ? 0 : t === 'TAR' ? 1 : 2);
        cell.groups.sort((a, b) =>
          rankTurno(a.turno) - rankTurno(b.turno) ||
          (rankFranja(a.franja) - rankFranja(b.franja)) ||
          (a.horas - b.horas) ||
          (a.puesto || '').localeCompare(b.puesto || '') ||
          (a.maquina || '').localeCompare(b.maquina || '')
        );
        for (const g of cell.groups) g.nombres.sort((a, b) => a.localeCompare(b));
      }
    }

    // 6) Orden de filas (no cambies tu criterio)
    const rowRank = (row: CalendarRow) => (row.reemplazo === '— Sin asignar') ? 2 : (row.isAutoOnly ? 1 : 0);
    this.calendarRows = Array.from(rowsMap.values()).sort((a, b) => rowRank(a) - rowRank(b) || a.reemplazo.localeCompare(b.reemplazo));
  }


  /** ✅ placeholders desactivables para filas AUTO-ONLY */
  private ensureSmartEmptySlots(cell: CalendarCell, allowPlaceholders: boolean) {
    if (!allowPlaceholders) return;
    const ocupadas = cell.groups.filter(g => !g.empty);
    const hayDiaCompleto = ocupadas.some(
      g => (g.franja?.toUpperCase() === 'DIA_COMPLETO') || (g.horas ?? 0) >= 8
    );
    if (hayDiaCompleto) return;

    if (ocupadas.length === 0) {
      for (const turno of this.TURNOS) {
        for (const franja of this.FRANJAS[turno]) {
          cell.groups.push({
            key: `—|—|${turno}|${franja}|4`,
            puesto: '—', maquina: '—', turno, franja, horas: 4, nombres: [], ids: [], empty: true
          });
        }
      }
      return;
    }

    const turnosConAlgo = new Set(ocupadas.map(g => g.turno).filter(Boolean) as string[]);
    for (const turno of turnosConAlgo) {
      for (const franja of (this.FRANJAS as any)[turno] || []) {
        const yaHayEsaFranja = cell.groups.some(g => !g.empty && g.turno === turno && g.franja === franja);
        const yaExistePlaceholder = cell.groups.some(g => g.empty && g.turno === turno && g.franja === franja);
        if (!yaHayEsaFranja && !yaExistePlaceholder) {
          cell.groups.push({
            key: `—|—|${turno}|${franja}|4`,
            puesto: '—', maquina: '—', turno, franja, horas: 4, nombres: [], ids: [], empty: true
          });
        }
      }
    }
  }

  // ===== Acciones desde Calendario =====
  isToday(iso: ISO): boolean { return this.toIsoLocal(new Date()) === iso; }

  selectById(id: number) {
    const d = this.descansosSemana.find(x => x.id === id);
    if (!d) { this.snack.open('No se encontró el registro.', 'OK', { duration: 2000 }); return; }
    this.selected = d;
    this.selectedId = d.id!;
    this.fActualizar.patchValue({
      id: d.id!,
      nuevaFecha: this.parseIso(d.fechaReduccion!),
      horas: d.horas ?? (d.franja === 'DIA_COMPLETO' ? 8 : 4),
      franja: d.franja || null,
      reemplazoId: null,
      forzar: false
    }, { emitEvent: false });
    this.cdr.markForCheck();
  }

  clearSelection() {
    this.selected = null;
    this.selectedId = null;
    this.cdr.markForCheck();
  }

  onClickPerson(group: CellGroup, idx: number) {
    const id = group.ids[idx];
    this.selectById(id);
  }

  /** ✅ Click en slot vacío → usar reemplazoId de la fila destino */
  onClickEmptySlot(row: CalendarRow, iso: ISO, _turno: string, franja: string) {
    if (this.selectedId) {
      this.openMoveModalToTarget(row, iso, franja);
      return;
    }
    const repId = row.reemplazo !== '— Sin asignar' ? (row.reemplazoId ?? null) : null;
    this.fCrear.patchValue({
      colaboradorId: null,
      fecha: this.parseIso(iso),
      horas: 4,
      franja,
      reemplazoId: repId,
      acumuladasPrevias: true,
      forzar: false
    }, { emitEvent: true });
    this.openCrearModal({ fecha: iso, franja });
  }

  // ===== Drag & Drop =====
  onDragStart(e: CdkDragStart<number>) { this.draggingId = e.source.data ?? null; this.snack.dismiss(); }
  onDragEnd(_: CdkDragEnd<number>) { this.draggingId = null; }

  /** ✅ Drop en slot vacío: abrir modal mover con reemplazoId de la fila */
  onDropToSlot(row: CalendarRow, iso: ISO, _turno: string, franja: string, ev: CdkDragDrop<any>) {
    const srcId = (ev?.item?.data ?? this.draggingId ?? this.selectedId) as number | null;
    if (!srcId) return;
    const d = this.descansosSemana.find(x => x.id === srcId);
    if (!d) return;
    this.selected = d;
    this.selectedId = srcId;
    this.openMoveModalToTarget(row, iso, franja);
  }

  // Drop sobre ocupado => modal swap (conservado)
  onDropOnOccupied(targetId: number, ev: CdkDragDrop<any>) {
    const srcId = (ev?.item?.data ?? this.draggingId ?? this.selectedId) as number | null;
    if (!srcId || srcId === targetId) return;
    const a = this.descansosSemana.find(x => x.id === srcId) || null;
    const b = this.descansosSemana.find(x => x.id === targetId) || null;
    if (!a || !b) return;
    this.swapA = a; this.swapB = b;
    this.openSwapModal();
  }

  /** ✅ Mover a destino con reemplazoId de la fila */
  private openMoveModalToTarget(row: CalendarRow, iso: ISO, franja: string) {
    if (!this.selected) return;
    const horasSel = (this.selected.horas ?? (this.selected.franja === 'DIA_COMPLETO' ? 8 : 4)) || 4;
    const repId = row.reemplazo !== '— Sin asignar' ? (row.reemplazoId ?? null) : null;

    this.fActualizar.patchValue({
      id: this.selected.id!,
      nuevaFecha: this.parseIso(iso),
      horas: horasSel,
      franja: horasSel === 8 ? 'DIA_COMPLETO' : (franja || null),
      reemplazoId: repId,
      forzar: false
    }, { emitEvent: false });
    this.openEditarModal();
  }

  /** ✅ Acción programática de mover con reemplazoId de la fila */
  private moveSelectedToSlot(row: CalendarRow, iso: ISO, _turno: string, franja: string) {
    if (!this.selectedId) return;
    const selectedHoras =
      (this.selected?.horas ?? (this.selected?.franja === 'DIA_COMPLETO' ? 8 : 4)) || 4;
    const repId = row.reemplazo !== '— Sin asignar' ? (row.reemplazoId ?? null) : null;

    this.working = true;
    const req = {
      id: this.selectedId!,
      nuevaFecha: iso,
      horas: selectedHoras,
      franja: selectedHoras === 8 ? 'DIA_COMPLETO' : franja,
      reemplazoId: repId,
      forzar: this.fActualizar.value.forzar ?? false
    };

    this.crud.actualizar(req).subscribe({
      next: () => {
        this.snack.open('✏️ Movido al slot seleccionado.', 'OK', { duration: 2000 });
        this.pendingScrollIso = iso;
        this.selected = null;
        this.selectedId = null;
        this.cargar();
      },
      error: err => this.snack.open('Error al mover: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => { this.working = false; this.cdr.markForCheck(); });
  }

  confirmarEliminar(d: DescansoY2) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar',
        message: `¿Eliminar el descanso de ${d.colaborador} el ${d.fechaReduccion}?`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      }
    });
    ref.afterClosed().subscribe((ok: boolean) => ok && this.eliminar(d.id!));
  }
  confirmarEliminarId(id: number) {
    const d = this.descansosSemana.find(x => x.id === id);
    if (d) this.confirmarEliminar(d);
  }

  eliminar(id: number) {
    this.working = true;
    this.crud.eliminar(id).subscribe({
      next: () => { this.snack.open('🗑️ Eliminado.', 'OK', { duration: 2000 }); this.cargar(); },
      error: err => this.snack.open('Error al eliminar: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => { this.working = false; this.cdr.markForCheck(); });
  }

  pickSwapA(d: DescansoY2) { this.swapA = d; }
  pickSwapB(d: DescansoY2) { this.swapB = d; }
  startSwapAById(id: number) { const d = this.descansosSemana.find(x => x.id === id); if (d) this.pickSwapA(d); }
  startSwapBById(id: number) { const d = this.descansosSemana.find(x => x.id === id); if (d) this.pickSwapB(d); }
  doSwap() {
    if (!this.swapA || !this.swapB) { this.snack.open('Selecciona A y B para intercambiar.', 'OK', { duration: 2000 }); return; }
    if (this.swapA.id === this.swapB.id) { this.snack.open('A y B no pueden ser el mismo.', 'OK', { duration: 2000 }); return; }
    this.working = true;
    this.crud.swap({ idA: this.swapA.id!, idB: this.swapB.id!, forzar: this.forzarSwap }).subscribe({
      next: () => { this.snack.open('🔁 Intercambio realizado.', 'OK', { duration: 2200 }); this.swapA = this.swapB = null; this.cargar(); },
      error: err => this.snack.open('Error en swap: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => { this.working = false; this.cdr.markForCheck(); });
  }

  private openSwapModal() {
    const ref = this.dialog.open(this.swapDialog, {
      width: '640px',
      autoFocus: false,
      restoreFocus: false
    });
    ref.afterClosed().subscribe(res => { if (res === 'swap') this.doSwap(); });
  }

  // ==== Helpers varias ====
  backlogDe(id: number): Y2BacklogItemDTO | undefined {
    return this.backlog.find(b => b.colaboradorId === id);
  }
  disponiblesDeItem(item?: Y2BacklogItemDTO): Y2DisponibilidadDTO[] {
    return item?.y2Disponibles || [];
  }
  slotsDeItem(item?: Y2BacklogItemDTO): Y2SlotDTO[] {
    return item?.slotsVaciosDia || [];
  }
  volver() { this.router.navigate(['/descansos-y2'], { queryParams: { domingo: this.domingo } }); }
  goToAcciones() {
    setTimeout(() => document.getElementById('accionesPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  private scrollToIso(iso: ISO) {
    const host = this.tableScrollRef?.nativeElement;
    if (!host) return;
    const target = host.querySelector(`td[data-iso="${iso}"]`) as HTMLElement | null
      || host.querySelector(`th[data-iso="${iso}"]`) as HTMLElement | null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      this.flashColumn(iso);
    }
  }
  private flashColumn(iso: ISO) {
    const host = this.tableScrollRef?.nativeElement;
    if (!host) return;
    const cells = host.querySelectorAll<HTMLElement>(`[data-iso="${iso}"]`);
    cells.forEach((el) => el.classList.add('flash'));
    setTimeout(() => cells.forEach((el) => el.classList.remove('flash')), 1500);
    this.cdr.markForCheck();
  }

  // ===== Modales =====
  openCrearModal(preset?: { fecha?: ISO; franja?: string }) {
    if (preset?.fecha) this.fCrear.get('fecha')!.setValue(this.parseIso(preset.fecha));
    if (preset?.franja) this.fCrear.get('franja')!.setValue(preset.franja);
    const ref = this.dialog.open(this.crearDialog, {
      width: '760px',
      autoFocus: false,
      restoreFocus: false
    });
    ref.afterClosed().subscribe(res => { if (res === 'crear') this.crear(); });
  }

  openEditarModal() {
    if (!this.fActualizar.value.id && this.selectedId) {
      this.fActualizar.get('id')!.setValue(this.selectedId);
    }
    const ref = this.dialog.open(this.editarDialog, {
      width: '760px',
      autoFocus: false,
      restoreFocus: false
    });
    ref.afterClosed().subscribe(res => { if (res === 'guardar') this.actualizar(); });
  }

  // ===== Fechas
  private toIsoLocal(d: Date): ISO {
    const tz = d.getTimezoneOffset();
    const f = new Date(d.getTime() - tz * 60000);
    return f.toISOString().slice(0, 10);
  }
  private parseIso(iso: ISO): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  private toIsoSunday(from: Date): ISO {
    const local = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const dow = local.getDay(); // 0 Dom
    const sunday = new Date(local);
    sunday.setDate(local.getDate() - dow);
    return this.toIsoLocal(sunday);
  }

  // ===== CRUD =====
  crear() {
    if (this.fCrear.invalid) { this.snack.open('Completa los datos requeridos.', 'OK', { duration: 2000 }); return; }
    const v = this.fCrear.value;
    this.working = true;
    const req = {
      colaboradorId: v.colaboradorId!,
      fecha: this.toIsoLocal(v.fecha!),
      horas: v.horas!,
      franja: v.horas === 8 ? 'DIA_COMPLETO' : (v.franja || null),
      reemplazoId: v.reemplazoId || null,
      acumuladasPrevias: v.acumuladasPrevias ?? true,
      forzar: v.forzar ?? false
    };
    this.crud.crear(req).subscribe({
      next: () => {
        const iso = this.toIsoLocal(this.fCrear.value.fecha!);
        this.pendingScrollIso = iso;
        this.snack.open('✅ Reduccion creada.', 'OK', { duration: 2200 });
        this.cargar();
      },
      error: err => this.snack.open('Error al crear: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => { this.working = false; this.cdr.markForCheck(); });
  }

  actualizar() {
    if (this.fActualizar.invalid) { this.snack.open('Selecciona el registro a actualizar.', 'OK', { duration: 2000 }); return; }
    const v = this.fActualizar.value;
    this.working = true;
    const req = {
      id: v.id!,
      nuevaFecha: v.nuevaFecha ? this.toIsoLocal(v.nuevaFecha) : null,
      horas: v.horas ?? null,
      franja: v.horas === 8 ? 'DIA_COMPLETO' : (v.franja || null),
      reemplazoId: v.reemplazoId || null,
      forzar: v.forzar ?? false
    };
    this.crud.actualizar(req).subscribe({
      next: () => {
        const iso = this.fActualizar.value.nuevaFecha ? this.toIsoLocal(this.fActualizar.value.nuevaFecha) : (this.selected?.fechaReduccion || null);
        if (iso) this.pendingScrollIso = iso;
        this.snack.open('✏️ Reduccion actualizada.', 'OK', { duration: 2200 });
        this.cargar();
      },
      error: err => this.snack.open('Error al actualizar: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => { this.working = false; this.cdr.markForCheck(); });
  }

  otorgarHoras() {
    if (this.fOtorgar.invalid) {
      this.snack.open('Selecciona colaborador y horas válidas.', 'OK', { duration: 2000 });
      return;
    }
    const v = this.fOtorgar.value;
    this.working = true;

    const req: Y2OtorgarHorasRequest = {
      domingoBase: this.domingo,
      colaboradorId: v.colaboradorId!,
      horas: Number(v.horas) || 0,
      diferirASiguiente: !!v.diferirASiguiente
    };

    this.crud.otorgarHoras(req).subscribe({
      next: () => {
        this.snack.open('✅ Horas otorgadas.', 'OK', { duration: 2200 });
        this.fOtorgar.reset({ colaboradorId: null, horas: 4, diferirASiguiente: false });
        this.cargar();
      },
      error: err => {
        this.snack.open('Error al otorgar horas: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 });
      }
    }).add(() => {
      this.working = false;
      this.cdr.markForCheck();
    });
  }

  editFromMenu(): void {
    const id = this.menuActiveId;
    if (id) this.selectById(id);
    this.goToAcciones();
  }

  cancelSwapA() { this.swapA = null; }
  cancelSwapB() { this.swapB = null; }

  /** ✅ Reutiliza moveSelectedToSlot con la fila de B si quisieras extender a “mover a fila de B” */
  moveSelectedToA(row?: CalendarRow) {
    if (!this.selected || !this.selectedId || !this.swapA) {
      this.snack.open('Selecciona un registro y marca A (Elegido).', 'OK', { duration: 2000 });
      return;
    }
    const iso = this.swapA.fechaReduccion!;
    const turno = this.canonTurno(this.swapA.turno) !== 'SIN'
      ? this.canonTurno(this.swapA.turno)
      : this.canonTurnoFromFranja(this.swapA.franja);
    const franja = (this.swapA.horas ?? 0) === 8 ? 'DIA_COMPLETO' : (this.swapA.franja || '06:00-10:00');

    // Si te interesa mover “a la fila de A”, pásale row (no obligatorio aquí)
    this.moveSelectedToSlot(row || { reemplazo: '— Sin asignar', reemplazoId: null, cells: {} }, iso, turno, franja);
  }

  editFromMenuModal(): void {
    const id = this.menuActiveId;
    if (id) { this.selectById(id); this.openEditarModal(); }
    else { this.snack.open('Primero selecciona un registro.', 'OK', { duration: 2000 }); }
  }

  recalcDisponiblesCrear(): void {
    const v = this.fCrear.value;

    // 1) Base por backlog del titular seleccionado
    const item = v.colaboradorId ? this.backlogDe(v.colaboradorId) : undefined;
    let lista: Y2DisponibilidadDTO[] = (item?.y2Disponibles ?? []).slice();

    // 2) Fallback robusto
    if (!lista.length && this.backlog?.length) {
      const candidatos = this.backlog
        .filter(b => (b.grupo || '').toUpperCase().includes('Y2') && b.colaboradorId !== v.colaboradorId)
        .map(b => ({
          colaboradorId: b.colaboradorId,
          nombre: b.nombre,
          observacionCompatibilidad: 'Candidato Y2 (fallback)'
        } as Y2DisponibilidadDTO));

      const uniq = new Map<number, Y2DisponibilidadDTO>();
      for (const c of candidatos) uniq.set(c.colaboradorId, c);
      lista = Array.from(uniq.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }

    this.disponiblesCrear = lista;

    // 3) Determinar turnoCrear (para combo de franjas)
    let turno: 'MAN' | 'TAR' | 'SIN' = 'SIN';
    if (v.franja) turno = this.canonTurnoFromFranja(v.franja);
    else if ((item as any)?.turnoSugerido) turno = this.canonTurno((item as any).turnoSugerido);
    if (turno === 'SIN') turno = 'MAN';
    this.turnoCrear = turno;

    // 4) Coherencia horas/franja
    if (v.horas === 8) this.fCrear.get('franja')!.setValue('DIA_COMPLETO', { emitEvent: false });
    else if (v.horas === 4 && this.fCrear.value.franja === 'DIA_COMPLETO') {
      this.fCrear.get('franja')!.setValue(null, { emitEvent: false });
    }

    this.cdr.markForCheck();
  }

  resetDerechos() {
    const d = this.domingo;
    const ok = confirm(
      `Esto consumirá backlog FIFO:\n\n` +
      `• Semana con turno NOCHE: se retiene 4h si tenía >4\n` +
      `• Demás semanas: backlog quedará en 0h\n\n` +
      `¿Continuar para la semana base ${d}?`
    );
    if (!ok) return;

    this.working = true;
    this.crud.resetDerechos(d).subscribe({
      next: (res: any) => {
        const base = res?.domingoBase || this.domingo;
        const afectados = res?.colaboradoresAfectados ?? res?.afectados ?? 0;

        const msg = `Reset OK. Colaboradores ajustados: ${afectados}. Semana base: ${base}`;
        this.snack.open(msg, 'OK', { duration: 4500 });
        this.cargar();
      },
      error: err => this.snack.open('Error en reset: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => { this.working = false; this.cdr.markForCheck(); });
  }
}
