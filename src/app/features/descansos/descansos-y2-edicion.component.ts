// C:\Proyectos\planificacion-inteligente\src\app\features\descansos\descansos-y2-edicion.component.ts
import { Component, OnInit, ViewEncapsulation, inject, HostBinding, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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

// App
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { IfRolesDirective } from 'src/app/shared/directives/if-roles.directive';
import { ConfirmDialogComponent } from 'src/app/features/programacion/dialogs/confirm-dialog.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { DescansosY2CrudService } from 'src/app/core/services/descansos-y2-crud.service';
import { DescansosY2Service } from 'src/app/core/services/descansos-y2.service';
import { Y2BacklogItemDTO, Y2DisponibilidadDTO, Y2SlotDTO, Y2OtorgarHorasRequest } from 'src/app/core/models/descanso-y2-crud.model';
import { DescansoY2 } from 'src/app/core/models/descanso-y2.model';

type ISO = string;

interface CalendarCol { label: string; iso: ISO; } // L..S
interface CellGroup {
  key: string;
  puesto: string;
  maquina: string;
  turno: string;
  franja: string;
  horas: number;
  nombres: string[];     // lista de nombres mostrados
  ids: number[];         // ids paralelos a 'nombres'
  empty?: boolean;       // marca slot vacío
}
interface CalendarCell { groups: CellGroup[]; }
interface CalendarRow { reemplazo: string; cells: Record<ISO, CalendarCell>; }

@Component({
  selector: 'app-descansos-y2-edicion',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    // Material
    MatButtonModule, MatIconModule, MatSnackBarModule, MatProgressBarModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatDatepickerModule, MatNativeDateModule, MatTableModule, MatTooltipModule, MatDialogModule, MatButtonToggleModule,
    // UI
    PageHeaderComponent, IfRolesDirective
  ],
  templateUrl: './descansos-y2-edicion.component.html',
  styleUrls: ['./descansos-y2-edicion.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'y2-edicion-page' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DescansosY2EdicionComponent implements OnInit {
  private crud = inject(DescansosY2CrudService);
  private svc = inject(DescansosY2Service); // listar descansos existentes (semana)
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private dialog = inject(MatDialog);

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

  // ===== NUEVO: Calendario estilo DescansosY2 =====
  calendarCols: CalendarCol[] = [];     // Lunes..Sábado
  calendarRows: CalendarRow[] = [];     // filas por "reemplazo"
  selected?: DescansoY2 | null;         // selección de un registro ocupado
  selectedId?: number | null;

  private readonly TURNOS = ['MAN', 'TAR'] as const;
  private readonly FRANJAS: Record<string, string[]> = {
    MAN: ['06:00-10:00', '10:00-14:00'],
    TAR: ['14:00-18:00', '18:00-22:00'],
  };

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

  // Swap (conservado)
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

    // Reglas horas/franja en formularios
    this.fCrear.get('horas')!.valueChanges.subscribe(h => {
      if (h === 8) this.fCrear.get('franja')!.setValue('DIA_COMPLETO');
      else if (this.fCrear.get('franja')!.value === 'DIA_COMPLETO') this.fCrear.get('franja')!.setValue(null);
    });
    this.fCrear.valueChanges.pipe(debounceTime(150)).subscribe(() => this.recalcDisponiblesCrear());
    this.recalcDisponiblesCrear();

    this.fActualizar.get('horas')!.valueChanges.subscribe(h => {
      if (h === 8) this.fActualizar.get('franja')!.setValue('DIA_COMPLETO');
      else if (this.fActualizar.get('franja')!.value === 'DIA_COMPLETO') this.fActualizar.get('franja')!.setValue(null);
    });
  }

  // ===== Helpers de normalización =====
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

  /** Para mostrar el badge en la UI (si decides usarlo en el template) */
  turnoBadge(t?: string | null): string {
    const v = (t || '').toUpperCase();
    if (v === 'MAN') return '06:00-14:00';
    if (v === 'TAR') return '14:00-22:00';
    return v || 'SIN TURNO';
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

        // listas auxiliares existentes
        this.colaboradoresList = this.backlog
          .map(b => ({ id: b.colaboradorId, nombre: b.nombre }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre));

        this.descansosData = this.descansosSemana.slice().sort((a, b) =>
          (a.fechaReduccion || '').localeCompare(b.fechaReduccion || '') ||
          (a.colaborador || '').localeCompare(b.colaborador || '')
        );

        // NUEVO: construir calendario al estilo DescansosY2
        this.buildCalendar();

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

  // ===== Calendario (idéntico look & feel a DescansosY2) =====
  private buildWeekCols(domingoISO: ISO) {
    const [y, m, d] = domingoISO.split('-').map(Number);
    const base = new Date(y, m - 1, d);
    const labels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    this.calendarCols = Array.from({ length: 6 }).map((_, i) => {
      const f = new Date(base);
      f.setDate(base.getDate() + (i + 1)); // +1 => lunes
      return { label: labels[i], iso: this.toIsoLocal(f) };
    });
  }

  private buildCalendar() {
    const colKeys = new Set(this.calendarCols.map(c => c.iso));
    const rowsMap = new Map<string, CalendarRow>();
    const SIN = '— Sin asignar';

    // Sembrar filas usando los reemplazos presentes en la semana (o SIN)
    for (const d of this.descansosSemana) {
      const rowKey = d.reemplazo && d.reemplazo.trim() !== '—' ? d.reemplazo.trim() : SIN;
      if (!rowsMap.has(rowKey)) rowsMap.set(rowKey, { reemplazo: rowKey, cells: {} });
    }
    if (!rowsMap.size) rowsMap.set(SIN, { reemplazo: SIN, cells: {} });

    // Poblar grupos ocupados
    for (const d of this.descansosSemana) {
      const iso = d.fechaReduccion;
      if (!colKeys.has(iso!)) continue;

      const rowKey = d.reemplazo && d.reemplazo.trim() !== '—' ? d.reemplazo.trim() : SIN;
      const row = rowsMap.get(rowKey)!;

      if (!row.cells[iso!]) row.cells[iso!] = { groups: [] };
      const puesto = d.puesto || '—';
      const maquina = d.maquina || '—';
      const franja = d.franja || '';
      const horas = d.horas || 0;

      // Normaliza turno a MAN/TAR (y si no viene, dedúcelo por franja)
      let turnoCanon = this.canonTurno(d.turno);
      if (turnoCanon === 'SIN') turnoCanon = this.canonTurnoFromFranja(franja);

      const gkey = `${puesto}|${maquina}|${turnoCanon}|${franja}|${horas}`;
      let group = row.cells[iso!].groups.find(g => g.key === gkey);
      if (!group) {
        group = { key: gkey, puesto, maquina, turno: turnoCanon, franja, horas, nombres: [], ids: [] };
        row.cells[iso!].groups.push(group);
      }
      group.nombres.push(d.colaborador!);
      group.ids.push(d.id!);
    }

    // Asegurar placeholders de franjas por turno
    for (const row of rowsMap.values()) {
      for (const col of this.calendarCols) {
        if (!row.cells[col.iso]) row.cells[col.iso] = { groups: [] };

        this.ensureSmartEmptySlots(row.cells[col.iso]);

      }

      // Ordenar grupos y nombres
      for (const iso of Object.keys(row.cells)) {
        const cell = row.cells[iso];
        // Orden por turno, franja, horas, puesto, máquina
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

    // Salida ordenada por reemplazo, dejando "— Sin asignar" al final
    this.calendarRows = Array.from(rowsMap.values()).sort((a, b) => {
      const A = a.reemplazo === SIN, B = b.reemplazo === SIN;
      if (A && !B) return 1;
      if (!A && B) return -1;
      return a.reemplazo.localeCompare(b.reemplazo);
    });
  }

  // Crea placeholders para todas las franjas de todos los turnos (si no hay grupos en la celda,
  // muestra MAN/TAR con sus dos franjas vacías)
  private ensureSmartEmptySlots(cell: CalendarCell) {
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
            puesto: '—', maquina: '—', turno, franja, horas: 4,
            nombres: [], ids: [], empty: true
          });
        }
      }
      return;
    }

    const turnosConAlgo = new Set(ocupadas.map(g => g.turno).filter(Boolean) as string[]);
    for (const turno of turnosConAlgo) {
      for (const franja of this.FRANJAS[turno] || []) {
        const yaHayEsaFranja = cell.groups.some(g => !g.empty && g.turno === turno && g.franja === franja);
        const yaExistePlaceholder = cell.groups.some(g => g.empty && g.turno === turno && g.franja === franja);
        if (!yaHayEsaFranja && !yaExistePlaceholder) {
          cell.groups.push({
            key: `—|—|${turno}|${franja}|4`,
            puesto: '—', maquina: '—', turno, franja, horas: 4,
            nombres: [], ids: [], empty: true
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
    // Prellenar fActualizar
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

  // Click en chip ocupado
  onClickPerson(group: CellGroup, idx: number) {
    const id = group.ids[idx];
    this.selectById(id);
  }

  // Click en slot vacío: si hay selección => mover; si no => prellenar crear
  onClickEmptySlot(iso: ISO, turno: string, franja: string) {
    if (this.selectedId) {
      this.moveSelectedToSlot(iso, turno, franja);
      return;
    }
    // Prellenar crear
    this.fCrear.patchValue({
      colaboradorId: null,
      fecha: this.parseIso(iso),
      horas: 4,
      franja,
      reemplazoId: null,
      acumuladasPrevias: true,
      forzar: false
    }, { emitEvent: true });
    this.snack.open(`Formulario "Crear" prellenado para ${iso} · ${franja}`, 'OK', { duration: 2200 });
    this.cdr.markForCheck();
  }

  // Mover seleccionado a un slot vacío concreto
  private moveSelectedToSlot(iso: ISO, turno: string, franja: string) {
    if (!this.selectedId) return;

    // Detecta horas reales del seleccionado
    const selectedHoras =
      (this.selected?.horas ?? (this.selected?.franja === 'DIA_COMPLETO' ? 8 : 4)) || 4;

    this.working = true;
    const req = {
      id: this.selectedId!,
      nuevaFecha: iso,
      horas: selectedHoras,
      franja: selectedHoras === 8 ? 'DIA_COMPLETO' : franja,
      reemplazoId: null,
      forzar: this.fActualizar.value.forzar ?? false
    };

    this.crud.actualizar(req).subscribe({
      next: () => {
        this.snack.open('✏️ Movido al slot seleccionado.', 'OK', { duration: 2000 });
        this.selected = null;
        this.selectedId = null;
        this.cargar();
      },
      error: err => this.snack.open('Error al mover: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => { this.working = false; this.cdr.markForCheck(); });
  }

  // Eliminar desde chip por ID
  eliminarById(id: number) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar',
        message: `¿Eliminar este descanso?`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar'
      }
    });
    ref.afterClosed().subscribe((ok: boolean) => ok && this.eliminar(id));
  }

  // ===== Helpers de disponibilidad para crear =====
  private recalcDisponiblesCrear() {
    const v = this.fCrear.value;
    if (!v.colaboradorId || !v.fecha || !v.horas) { this.disponiblesCrear = []; return; }
    const fechaIso = this.toIsoLocal(v.fecha as Date);
    const franja = v.horas === 8 ? 'DIA_COMPLETO' : (v.franja || null);

    this.crud.getSugerencia({ colaboradorId: v.colaboradorId!, fecha: fechaIso, horas: v.horas!, franja })
      .subscribe(sug => { this.turnoCrear = sug?.turno || null; this.cdr.markForCheck(); });

    this.crud.getDisponibles({ colaboradorId: v.colaboradorId!, fecha: fechaIso, horas: v.horas!, franja })
      .subscribe(list => { this.disponiblesCrear = list || []; this.cdr.markForCheck(); });
  }

  // ===== CRUD (tus métodos existentes, intactos) =====
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
      next: () => { this.snack.open('✅ Descanso Y2 creado.', 'OK', { duration: 2200 }); this.cargar(); },
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
      next: () => { this.snack.open('✏️ Descanso Y2 actualizado.', 'OK', { duration: 2200 }); this.cargar(); },
      error: err => this.snack.open('Error al actualizar: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
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

  eliminar(id: number) {
    this.working = true;
    this.crud.eliminar(id).subscribe({
      next: () => { this.snack.open('🗑️ Eliminado.', 'OK', { duration: 2000 }); this.cargar(); },
      error: err => this.snack.open('Error al eliminar: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => { this.working = false; this.cdr.markForCheck(); });
  }

  // Swap (conservado; además puedes combinar con selección desde calendario si quieres)
  pickSwapA(d: DescansoY2) { this.swapA = d; }
  pickSwapB(d: DescansoY2) { this.swapB = d; }
  doSwap() {
    if (!this.swapA || !this.swapB) { this.snack.open('Selecciona A y B para intercambiar.', 'OK', { duration: 2000 }); return; }
    if (this.swapA.id === this.swapB.id) { this.snack.open('A y B no pueden ser el mismo.', 'OK', { duration: 2000 }); return; }
    this.working = true;
    this.crud.swap({ idA: this.swapA.id!, idB: this.swapB.id!, forzar: this.forzarSwap }).subscribe({
      next: () => { this.snack.open('🔁 Intercambio realizado.', 'OK', { duration: 2200 }); this.swapA = this.swapB = null; this.cargar(); },
      error: err => this.snack.open('Error en swap: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => { this.working = false; this.cdr.markForCheck(); });
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

  otorgarHoras() {
    if (this.fOtorgar.invalid) {
      this.snack.open('Selecciona colaborador y horas válidas.', 'OK', { duration: 2000 });
      return;
    }

    const v = this.fOtorgar.value;
    this.working = true;

    const req: Y2OtorgarHorasRequest = {
      domingoBase: this.domingo,                         // ← requerido por el tipo
      colaboradorId: v.colaboradorId!,                   // number
      horas: Number(v.horas) || 0,                       // number
      diferirASiguiente: !!v.diferirASiguiente           // boolean
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

}
