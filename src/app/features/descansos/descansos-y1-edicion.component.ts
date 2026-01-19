// IMPORTS igual que los que ya tienes…
import { Component, OnInit, ViewEncapsulation, HostBinding, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { DescansosY1Service } from 'src/app/core/services/descansos-y1.service';
import { TrabajadorDomingo, ReemplazoY1, DescansoY1, IncidenciaDTO, Severity } from 'src/app/core/models/descanso-y1.model';
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { IfRolesDirective } from 'src/app/shared/directives/if-roles.directive';
import { ConfirmDialogComponent } from 'src/app/features/programacion/dialogs/confirm-dialog.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { DescansosY2Service } from 'src/app/core/services/descansos-y2.service';

type ISODate = string;

interface CalendarCol { label: string; iso: ISODate; }
interface CellGroup { key: string; puesto: string; maquina: string; turno: string; colaboradores: string[]; }
interface CalendarCell { groups: CellGroup[]; }
interface CalendarRow { reemplazo: string; cells: Record<ISODate, CalendarCell>; }

type Density = 'comfortable' | 'compact' | 'ultra';

@Component({
  selector: 'app-descansos-y1-edicion',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatProgressBarModule,
    MatFormFieldModule, MatInputModule, MatDialogModule, MatButtonToggleModule,
    MatDatepickerModule, MatNativeDateModule, MatSlideToggleModule, MatTooltipModule, MatSidenavModule, MatExpansionModule, MatChipsModule,
    PageHeaderComponent, IfRolesDirective
  ],
  templateUrl: './descansos-y1-edicion.component.html',
  styleUrls: ['./descansos-y1-edicion.component.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'descansos-y1-edicion-page' }
})
export class DescansosY1EdicionComponent implements OnInit {

  private svc = inject(DescansosY1Service);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private auth = inject(AuthService);
  private router = inject(Router);
  private y2 = inject(DescansosY2Service);        // + NUEVO
  private overlayY2Reduc = new Map<string, Set<ISODate>>(); // + NUEVO

  trabajadores: TrabajadorDomingo[] = [];
  reemplazos: ReemplazoY1[] = [];
  descansos: DescansoY1[] = [];

  calendarCols: CalendarCol[] = [];
  calendarRows: CalendarRow[] = [];

  loading = true;
  fullscreenLoading = false;
  domingoActual!: string;
  habilitaAnterior = false;
  habilitaSiguiente = false;

  filtroReemplazo = '';
  filtroNombre = '';

  selected?: DescansoY1;
  nuevaFechaDate: Date | null = null;
  forzar = false;

  swapMode = false;
  swapBucket: DescansoY1[] = [];
  forzarSwap = false;

  incidencias: IncidenciaDTO[] = [];
  incidenciasVisible = true;

  // ⚡ NUEVO: reset individual
  incluirManualesReset = false;
  noAvanzaRotacion = true; // por defecto: NO regenerar

  incFilter: 'ALL' | 'INFO' | 'WARNING' | 'ERROR' = 'ALL';

  editorOpen = false;
  openEditor() { this.editorOpen = true; }
  closeEditor() { this.editorOpen = false; }

  density: Density = (localStorage.getItem('descansos.edicion.density') as Density) || 'comfortable';
  @HostBinding('class.density-compact') get _isCompact() { return this.density === 'compact'; }
  @HostBinding('class.density-ultra') get _isUltra() { return this.density === 'ultra'; }
  setDensity(d: Density) { this.density = d; localStorage.setItem('descansos.edicion.density', d); }

  volverADomingo(): void { this.router.navigate(['/domingo']); }

  // normalizador reutilizable (igual al de la vista)
  private norm(s?: string | null): string {
    return (s || '')
      .trim()
      .replace(/\s+/g, ' ')
      .normalize('NFD').replace(/\p{Diacritic}/gu, '')
      .toUpperCase();
  }

  // helper para el template
  tieneReduccion(nombreFila: string, iso: ISODate): boolean {
    return this.overlayY2Reduc.get(this.norm(nombreFila))?.has(iso) ?? false;
  }

  get subtitle(): string {
    const d0 = this.parseIsoDateLocal(this.domingoActual);
    const d6 = new Date(d0); d6.setDate(d0.getDate() + 6);
    const fmt = "d 'de' MMMM 'de' y";
    const ini = formatDate(d0, fmt, 'es-CO');
    const fin = formatDate(d6, fmt, 'es-CO');
    return `Semana del ${ini} al ${fin}`;
  }

  get canEdit(): boolean { return this.auth.hasAnyRole(['SUPERVISOR', 'ADMIN']); }

  ngOnInit(): void {
    const todayIso = this.todayIsoInTZ('America/Bogota');
    const dow = this.dayOfWeekInTZ(todayIso, 'America/Bogota');
    const sundayIso = this.addDaysIso(todayIso, -dow);
    this.domingoActual = sundayIso;
    this.buildWeekFromDomingo(this.domingoActual);
    this.cargarDatos(this.domingoActual);
    this.refrescarBotones(this.domingoActual);
    this.cargarIncidencias(this.domingoActual);
  }

  // ====== fechas util ======
  private toIsoLocal(date: Date): ISODate {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  private parseIsoDateLocal(iso: ISODate): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  private buildWeekFromDomingo(domingoISO: string) {
    const labels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    this.calendarCols = Array.from({ length: 7 }).map((_, i) => ({
      label: labels[i],
      iso: this.addDaysIso(domingoISO, i)
    }));
  }
  isToday(iso: ISODate): boolean { return this.toIsoLocal(new Date()) === iso; }
  private todayIsoInTZ(tz: string): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  private dayOfWeekInTZ(iso: string, tz: string): number {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const wk = dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: tz });
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wk);
  }
  private addDaysIso(iso: string, days: number): string {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt.toISOString().slice(0, 10);
  }

  // ================= Datos / calendario =================
  cargarDatos(domingo?: string): void {
    this.loading = true;
    forkJoin({
      trabajadores: this.svc.getTrabajadores(domingo),
      reemplazos: this.svc.getReemplazos(domingo),
      descansos: this.svc.getDescansos(domingo),
      y2:           this.y2.getDescansos(domingo)
    }).subscribe({
      next: ({ trabajadores, reemplazos, descansos, y2 }) => {
        this.trabajadores = trabajadores;
        this.reemplazos = reemplazos;
        this.descansos = descansos;

        this.overlayY2Reduc.clear();
      for (const d of y2 || []) {
        const modalidad = (d.modalidad || '').toUpperCase();
        if (modalidad.includes('AUTO')) continue; // los AUTO no ocupan a nadie

        const key = this.norm(d.reemplazo);
        if (!key || key === '—') continue;

        const iso = d.fechaReduccion;
        if (!this.overlayY2Reduc.has(key)) this.overlayY2Reduc.set(key, new Set<ISODate>());
        this.overlayY2Reduc.get(key)!.add(iso);
      }

        this.buildCalendar();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando datos:', err);
        this.loading = false;
        this.snack.open('⚠️ Error cargando datos', 'OK', { duration: 3000 });
      }
    });
  }

  private buildCalendar() {
    const rowsMap = new Map<string, CalendarRow>();
    const colKeys = new Set(this.calendarCols.map(c => c.iso));
    const SIN_ASIGNAR_KEY = '— Sin asignar';
    const y1Name = (r: ReemplazoY1) => (r.reemplazo?.trim() || '—');

    const seeded = new Set<string>();
    for (const r of this.reemplazos) {
      const nombre = y1Name(r);
      const key = nombre !== '—' ? nombre : SIN_ASIGNAR_KEY;
      if (!seeded.has(key)) {
        seeded.add(key);
        rowsMap.set(key, { reemplazo: key, cells: {} });
      }
    }

    for (const d of this.descansos) {
      const iso = d.fechaDescanso;
      if (!colKeys.has(iso)) continue;

      const rowKey = d.reemplazo && d.reemplazo.trim() !== '—' ? d.reemplazo.trim() : SIN_ASIGNAR_KEY;
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

    this.calendarRows = Array.from(rowsMap.values()).sort((a, b) => {
      const A = a.reemplazo === SIN_ASIGNAR_KEY, B = b.reemplazo === SIN_ASIGNAR_KEY;
      if (A && !B) return 1;
      if (!A && B) return -1;
      return a.reemplazo.localeCompare(b.reemplazo);
    });
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
        for (const g of row.cells[iso].groups) {
          if (g.colaboradores.some(n => n.toLowerCase().includes(fn))) return true;
        }
      }
      return false;
    });
  }
  trackByCol = (_: number, c: CalendarCol) => c.iso;
  trackByRow = (_: number, r: CalendarRow) => r.reemplazo;

  // ===== Navegación de semana =====
  refrescarBotones(desde: string): void {
    this.svc.getDomingoAnterior(desde).subscribe({ next: d => this.habilitaAnterior = !!d, error: () => this.habilitaAnterior = false });
    this.svc.getDomingoSiguiente(desde).subscribe({ next: d => this.habilitaSiguiente = !!d, error: () => this.habilitaSiguiente = false });
  }
  irAnterior(): void {
    this.svc.getDomingoAnterior(this.domingoActual).subscribe({
      next: (d) => {
        if (d) { this.domingoActual = d; this.buildWeekFromDomingo(d); this.cargarDatos(d); this.refrescarBotones(d); this.cargarIncidencias(d); this.resetSelection(); }
      }
    });
  }
  irSiguiente(): void {
    this.svc.getDomingoSiguiente(this.domingoActual).subscribe({
      next: (d) => {
        if (d) { this.domingoActual = d; this.buildWeekFromDomingo(d); this.cargarDatos(d); this.refrescarBotones(d); this.cargarIncidencias(d); this.resetSelection(); }
      }
    });
  }

  // ===== Acciones (confirm + roles) =====
  private abrirConfirm(message: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Confirmación', message, confirmText: 'Confirmar', cancelText: 'Cancelar' }
    });
    return firstValueFrom(ref.afterClosed());
  }

  async generarDescansos(): Promise<void> {
    if (!this.auth.hasRole('ADMIN')) { this.snack.open('No autorizado (solo ADMIN).', 'OK', { duration: 2500 }); return; }
    const ok = await this.abrirConfirm('¿Generar descansos para la semana seleccionada?');
    if (!ok) return;
    this.fullscreenLoading = true;
    this.svc.generarDescansos(this.domingoActual).subscribe({
      next: () => { this.snack.open('✅ Descansos generados.', 'OK', { duration: 2500 }); this.cargarDatos(this.domingoActual); this.cargarIncidencias(this.domingoActual); },
      error: err => this.snack.open('Error al generar: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => this.fullscreenLoading = false);
  }

  async eliminarDescansos(): Promise<void> {
    if (!this.auth.hasRole('ADMIN')) { this.snack.open('No autorizado (solo ADMIN).', 'OK', { duration: 2500 }); return; }
    const ok = await this.abrirConfirm('⚠️ Esto eliminará todos los descansos de la semana. ¿Continuar?');
    if (!ok) return;
    this.fullscreenLoading = true;
    this.svc.eliminarDescansos(this.domingoActual).subscribe({
      next: () => { this.snack.open('🗑️ Descansos eliminados.', 'OK', { duration: 2500 }); this.cargarDatos(this.domingoActual); this.cargarIncidencias(this.domingoActual); this.resetSelection(); },
      error: err => this.snack.open('Error al eliminar: ' + (err?.error || err?.message || 'desconocido'), 'OK', { duration: 3500 })
    }).add(() => this.fullscreenLoading = false);
  }

  // ===== Selección desde la grilla =====
  private findDescanso(colaborador: string, iso: ISODate): DescansoY1 | undefined {
    return this.descansos.find(d => d.colaborador === colaborador && d.fechaDescanso === iso);
  }

  onClickNombre(colaborador: string, iso: ISODate): void {
    if (!this.canEdit) return;
    const d = this.findDescanso(colaborador, iso);
    if (!d) { this.snack.open('No se encontró el descanso seleccionado.', 'OK', { duration: 2500 }); return; }
    this.selected = d;
    this.nuevaFechaDate = this.parseIsoDateLocal(d.fechaDescanso);
    this.forzar = false;
    this.openEditor();
  }

  isSelected(colaborador: string, iso: ISODate): boolean {
    return !!this.selected && this.selected.colaborador === colaborador && this.selected.fechaDescanso === iso;
  }

  resetSelection(): void {
    this.selected = undefined;
    this.nuevaFechaDate = null;
    this.forzar = false;
    this.incluirManualesReset = false;
    this.closeEditor();
  }

  // ===== Mover descanso =====
  moverSeleccion(): void {
    if (!this.selected) return;
    if (!this.nuevaFechaDate) { this.snack.open('Selecciona una nueva fecha.', 'OK', { duration: 2000 }); return; }
    const nuevaISO = this.toIsoLocal(this.nuevaFechaDate);
    const rep = this.selected.reemplazo || '—';
  if (this.tieneReduccion(rep, nuevaISO)) {
    this.snack.open('⛔ No se puede mover: el reemplazo tiene una Reducción (Y2) ese día.', 'OK', { duration: 3200 });
    return;
  }
    this.svc.moverDescanso(this.selected.id, nuevaISO, this.forzar).subscribe({
      next: (incs) => { this.setIncidencias(incs); this.cargarDatos(this.domingoActual); this.resetSelection(); },
      error: (e) => { console.error(e); this.snack.open('⚠️ Error al mover el descanso.', 'OK', { duration: 3000 }); }
    });
  }

  quickPick(iso: ISODate): void {
    if (!this.selected) return;
    this.nuevaFechaDate = this.parseIsoDateLocal(iso);
  }

  // ===== Intercambio =====
  toggleSwap(): void {
    if (!this.canEdit) { this.snack.open('No autorizado.', 'OK', { duration: 2000 }); return; }
    this.swapMode = !this.swapMode;
    if (this.swapMode) {
      this.snack.open('Modo intercambio ACTIVADO. Selecciona dos descansos.', 'OK', { duration: 2500 });
    } else {
      this.swapBucket = [];
      this.forzarSwap = false;
    }
  }
  addSelectedToSwap(): void {
    if (!this.swapMode) return;
    if (!this.selected) { this.snack.open('Primero selecciona un descanso.', 'OK', { duration: 2000 }); return; }
    if (this.swapBucket.find(x => x.id === this.selected!.id)) return;
    if (this.swapBucket.length >= 2) { this.snack.open('Ya hay 2 elementos en el intercambio.', 'OK', { duration: 2500 }); return; }
    this.swapBucket.push(this.selected);
  }
  removeFromSwap(d: DescansoY1): void {
    this.swapBucket = this.swapBucket.filter(x => x.id !== d.id);
  }
  canSwap(): boolean { return this.swapBucket.length === 2; }

  ejecutarSwap(): void {
    if (!this.canSwap()) return;
    const [a, b] = this.swapBucket;

    // Validar destino de A y destino de B:
  // A va a la fecha de B, y B va a la fecha de A (mismo reemplazo de cada uno).
    const repA = a.reemplazo || '—';
    const repB = b.reemplazo || '—';
    const destA = b.fechaDescanso;
    const destB = a.fechaDescanso;

    if (this.tieneReduccion(repA, destA)) {
      this.snack.open(`⛔ No se puede intercambiar: ${repA} tiene Reducción el ${destA}.`, 'OK', { duration: 3200 });
      return;
    }
    if (this.tieneReduccion(repB, destB)) {
      this.snack.open(`⛔ No se puede intercambiar: ${repB} tiene Reducción el ${destB}.`, 'OK', { duration: 3200 });
      return;
    }

    this.fullscreenLoading = true;
    this.svc.intercambiarDescansos(a.id, b.id, this.forzarSwap).subscribe({
      next: (incs) => { this.setIncidencias(incs); this.cargarDatos(this.domingoActual); this.swapBucket = []; this.swapMode = false; },
      error: (e) => { console.error(e); this.snack.open('⚠️ Error al intercambiar descansos.', 'OK', { duration: 3000 }); }
    }).add(() => this.fullscreenLoading = false);
  }


  limpiarSwap(): void { this.swapBucket = []; }

  // ===== Rebalanceo + Incidencias =====
  rebalancear(): void {
    if (!this.canEdit) { this.snack.open('No autorizado.', 'OK', { duration: 2000 }); return; }
    this.fullscreenLoading = true;
    this.svc.rebalancearSemana(this.domingoActual).subscribe({
      next: (incs) => { this.setIncidencias(incs); this.cargarDatos(this.domingoActual); },
      error: (e) => { console.error(e); this.snack.open('⚠️ Error al rebalancear la semana.', 'OK', { duration: 3000 }); }
    }).add(() => this.fullscreenLoading = false);
  }

  cargarIncidencias(domingo: string): void {
    this.svc.listarIncidencias(domingo).subscribe({
      next: (incs) => this.setIncidencias(incs),
      error: () => { /* noop */ }
    });
  }
  private setIncidencias(incs: IncidenciaDTO[]): void {
    this.incidencias = Array.isArray(incs) ? incs : [];
    if (this.incidencias.some(i => i.severity === 'ERROR')) this.incidenciasVisible = true;
  }
  badgeClass(sev: Severity): string {
    switch (sev) {
      case 'ERROR': return 'bg-danger';
      case 'WARNING': return 'bg-warning text-dark';
      default: return 'bg-info';
    }
  }
  private countBy(sev: Severity): number {
    return Array.isArray(this.incidencias)
      ? this.incidencias.reduce((acc, i) => acc + (i?.severity === sev ? 1 : 0), 0)
      : 0;
  }
  get incInfo(): number { return this.countBy('INFO'); }
  get incWarn(): number { return this.countBy('WARNING'); }
  get incError(): number { return this.countBy('ERROR'); }

  // ⚡ NUEVO: reset SOLO del colaborador seleccionado
  async resetColaborador(): Promise<void> {
    if (!this.auth.hasRole('ADMIN') || !this.selected) { /* ... */ return; }
    const cid = this.selected.colaboradorId!;
    const ok = await this.abrirConfirm(
      `¿${this.noAvanzaRotacion ? 'Eliminar SIN regenerar (no avanza rotación)' : 'Restablecer (sí avanza)'} a "${this.selected.colaborador}" en ${this.domingoActual}?`
    );
    if (!ok) return;

    this.fullscreenLoading = true;
    const call$ = this.noAvanzaRotacion
      ? this.svc.quitarSemanaColaborador(this.domingoActual, cid, this.incluirManualesReset) // ❌ no consume rotación
      : this.svc.resetSemanaColaborador(this.domingoActual, cid, this.incluirManualesReset, true); // ✅ regenera (consume)

    call$.subscribe({
      next: (incs) => { this.setIncidencias(incs); this.cargarDatos(this.domingoActual); this.resetSelection(); this.snack.open('Hecho.', 'OK', { duration: 2500 }); },
      error: () => this.snack.open('⚠️ Error.', 'OK', { duration: 3000 })
    }).add(() => this.fullscreenLoading = false);
  }

  // (Opcional) eliminar solo el descanso actual
  async eliminarSeleccion(): Promise<void> {
    if (!this.canEdit || !this.selected) return;
    const ok = await this.abrirConfirm(`¿Eliminar el descanso de ${this.selected.colaborador} del ${this.selected.fechaDescanso}? (no avanza rotación)`);
    if (!ok) return;

    this.fullscreenLoading = true;
    this.svc.eliminarDescanso(this.selected.id).subscribe({
      next: (incs) => { this.setIncidencias(incs); this.cargarDatos(this.domingoActual); this.resetSelection(); this.snack.open('🗑️ Descanso eliminado.', 'OK', { duration: 2500 }); },
      error: () => this.snack.open('⚠️ Error al eliminar.', 'OK', { duration: 3000 })
    }).add(() => this.fullscreenLoading = false);
  }
  get filteredIncidencias(): IncidenciaDTO[] {
    const f = this.incFilter;
    return (this.incidencias || []).filter(i => f === 'ALL' ? true : i.severity === f);
  }

  trackByInc = (_: number, i: IncidenciaDTO) =>
    `${i.code}|${i.severity}|${i.domingoBase}|${i.message?.slice(0, 32)}`;

  severityIcon(sev: Severity): string {
    return sev === 'ERROR' ? 'error' : sev === 'WARNING' ? 'warning' : 'info';
  }

  panelClass(sev: Severity) {
    return {
      'sev-ERROR': sev === 'ERROR',
      'sev-WARNING': sev === 'WARNING',
      'sev-INFO': sev === 'INFO',
    };
  }

  sevChipClass(sev: Severity) {
    return {
      'chip-error': sev === 'ERROR',
      'chip-warn': sev === 'WARNING',
      'chip-info': sev === 'INFO',
    };
  }

  copyInc(i: IncidenciaDTO) {
    const txt = JSON.stringify(i, null, 2);
    navigator.clipboard.writeText(txt);
    this.snack.open('Copiado al portapapeles', 'OK', { duration: 1500 });
  }

  irA(iso: string) {
    this.domingoActual = iso;
    this.buildWeekFromDomingo(iso);
    this.cargarDatos(iso);
    this.refrescarBotones(iso);
    this.cargarIncidencias(iso);
    this.resetSelection();
  }
}
