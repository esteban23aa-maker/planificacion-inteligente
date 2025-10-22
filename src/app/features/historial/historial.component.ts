import { Component, OnInit, ViewChild, ViewEncapsulation, HostBinding, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Material
import { MatTableModule } from '@angular/material/table';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';

// App
import { HistorialService } from 'src/app/core/services/historial.service';
import { HistorialCambio } from 'src/app/core/models/historial.model';
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';

type Density = 'comfortable' | 'compact' | 'ultra';

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    // Material
    MatTableModule, MatPaginatorModule, MatSortModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatButtonToggleModule,
    MatIconModule, MatSnackBarModule, MatTooltipModule,
    MatProgressBarModule,
    // UI
    PageHeaderComponent
  ],
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'historial-page' }
})
export class HistorialComponent implements OnInit {

  // ===== Injections
  private histSvc = inject(HistorialService);
  private snack = inject(MatSnackBar);

  // ===== Estado base
  loading = false;
  data: HistorialCambio[] = [];
  dataSource = new MatTableDataSource<HistorialCambio>([]);
  displayedColumns = ['fechaHora', 'tipoCambio', 'descripcion', 'realizadoPor', 'colaboradorId', 'colaboradorNombre'];

  // ===== Paginator / Sort
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // ===== Filtros
  textoBusqueda = '';
  tipoSeleccionado: string | null = null;
  responsableSeleccionado: string | null = null;
  colaboradorId: number | null = null;
  fechaDesde: Date | null = null;
  fechaHasta: Date | null = null;
  filtrosAbiertos = false;

  tipos: string[] = ['ASIGNACION', 'DESCANSO_Y1', 'DESCANSO_Y2', 'SUGERENCIA', 'MANUAL'];
  responsables: string[] = []; // se llena desde data

  // ===== Densidad
  density: Density = (localStorage.getItem('historial.density') as Density) || 'comfortable';
  @HostBinding('class.density-compact') get _isCompact() { return this.density === 'compact'; }
  @HostBinding('class.density-ultra') get _isUltra() { return this.density === 'ultra'; }
  setDensity(d: Density) { this.density = d; localStorage.setItem('historial.density', d); }

  // Header
  get subtitle(): string {
    const hoy = new Date();
    return `Actualizado al ${formatDate(hoy, "d 'de' MMMM 'de' y, h:mm a", 'es-CO')}`;
  }

  ngOnInit(): void {
    this.cargarHistorial();
    // DataSource: custom sorting for date column
    this.dataSource.sortingDataAccessor = (item, property) => {
      if (property === 'fechaHora') return new Date(item.fechaHora).getTime();
      return (item as any)[property];
    };
  }

  // ===== Carga
  cargarHistorial(): void {
    this.loading = true;
    this.histSvc.obtenerTodos().subscribe({
      next: (data) => {
        // Orden descendente por fecha
        const sorted = (data || []).slice().sort((a, b) =>
          new Date(b.fechaHora).getTime() - new Date(a.fechaHora).getTime()
        );
        this.data = sorted;
        this.responsables = Array.from(new Set(sorted.map(x => x.realizadoPor))).sort((a, b) => a.localeCompare(b));
        this.aplicarFiltros(); // set dataSource
      },
      error: () => {
        this.toast('Error al cargar historial');
      },
      complete: () => this.loading = false
    });
  }

  // ===== Filtros
  private normalizarTexto(v: any): string {
    return (v ?? '').toString().trim().toLowerCase();
  }

  aplicarFiltros(): void {
    const termino = this.normalizarTexto(this.textoBusqueda);
    const tipo = this.tipoSeleccionado || '';
    const resp = this.responsableSeleccionado || '';
    const id = this.colaboradorId;

    const desdeTime = this.fechaDesde ? this.inicioDelDia(this.fechaDesde).getTime() : null;
    const hastaTime = this.fechaHasta ? this.finDelDia(this.fechaHasta).getTime() : null;

    const filtrados = this.data.filter(c => {
      if (tipo && c.tipoCambio !== tipo) return false;
      if (resp && c.realizadoPor !== resp) return false;
      if (id != null && +id > 0 && c.colaboradorId !== +id) return false;

      const t = new Date(c.fechaHora).getTime();
      if (desdeTime != null && t < desdeTime) return false;
      if (hastaTime != null && t > hastaTime) return false;

      if (termino) {
        const hay = this.normalizarTexto(c.realizadoPor).includes(termino)
          || this.normalizarTexto(c.descripcion).includes(termino)
          || this.normalizarTexto(c.colaboradorNombre).includes(termino);
        if (!hay) return false;
      }
      return true;
    });

    this.dataSource.data = filtrados;

    // Paginador / sort
    if (this.paginator) this.dataSource.paginator = this.paginator;
    if (this.sort) this.dataSource.sort = this.sort;
  }

  limpiarFiltros(): void {
    this.textoBusqueda = '';
    this.tipoSeleccionado = null;
    this.responsableSeleccionado = null;
    this.colaboradorId = null;
    this.fechaDesde = null;
    this.fechaHasta = null;
    this.aplicarFiltros();
  }

  get filtrosActivos(): number {
    let n = 0;
    if (this.textoBusqueda.trim()) n++;
    if (this.tipoSeleccionado) n++;
    if (this.responsableSeleccionado) n++;
    if (this.colaboradorId) n++;
    if (this.fechaDesde) n++;
    if (this.fechaHasta) n++;
    return n;
  }

  // Presets de fecha
  preset7d(): void {
    const hoy = new Date();
    const d = new Date(); d.setDate(hoy.getDate() - 7);
    this.fechaDesde = d; this.fechaHasta = hoy;
    this.aplicarFiltros();
  }
  preset30d(): void {
    const hoy = new Date();
    const d = new Date(); d.setDate(hoy.getDate() - 30);
    this.fechaDesde = d; this.fechaHasta = hoy;
    this.aplicarFiltros();
  }
  presetTodo(): void {
    this.fechaDesde = null; this.fechaHasta = null; this.aplicarFiltros();
  }

  // ===== Utilidades fecha (día completo)
  private inicioDelDia(d: Date): Date {
    const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
  }
  private finDelDia(d: Date): Date {
    const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
  }

  // ===== Export CSV (filtrado actual)
  exportCsv(): void {
    const rows = this.dataSource.data || [];
    if (!rows.length) { this.toast('No hay datos filtrados para exportar'); return; }

    const headers = ['Fecha', 'Tipo', 'Descripción', 'Responsable', 'ID Colaborador', 'Nombre'];
    const lines = [
      headers.join(','),
      ...rows.map(r => [
        formatDate(r.fechaHora, 'yyyy-MM-dd HH:mm', 'es-CO'),
        r.tipoCambio || '',
        this.csvSafe(r.descripcion || ''),
        r.realizadoPor || '',
        (r.colaboradorId ?? '').toString(),
        this.csvSafe(r.colaboradorNombre || '')
      ].join(','))
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = formatDate(new Date(), 'yyyyMMdd_HHmmss', 'es-CO');
    a.download = `historial_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.toast('📤 Exportado CSV', true);
  }

  private csvSafe(text: string): string {
    if (text == null) return '';
    const t = text.replace(/"/g, '""');
    return /[",\n]/.test(t) ? `"${t}"` : t;
  }

  // ===== Helpers
  private toast(msg: string, ok = false) {
    this.snack.open(msg, ok ? 'OK' : 'Cerrar', { duration: ok ? 2200 : 3500 });
  }

}
