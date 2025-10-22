// Crea Colaborador – Material PRO MAX (manteniendo servicios/contratos)
import {
  Component, OnInit, ViewChild, ElementRef,
  ViewEncapsulation, HostBinding, inject
} from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

// Material
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';

// App / UI
import { ColaboradoresService } from 'src/app/core/services/colaboradores.service';
import { CargaInicialService } from 'src/app/core/services/carga-inicial.service';
import { Colaborador } from 'src/app/core/models/colaborador.model';
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { ConfirmDialogComponent } from 'src/app/features/programacion/dialogs/confirm-dialog.component';

// Excel
import * as XLSX from 'xlsx';

type Density = 'comfortable' | 'compact' | 'ultra';
type HeaderVariant = 'neutral' | 'brand';
@Component({
  selector: 'app-crear-colaborador',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    // Material
    MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule,
    MatSnackBarModule, MatTableModule, MatPaginatorModule, MatSortModule,
    MatTooltipModule, MatDialogModule, MatProgressBarModule, MatButtonToggleModule,
    // UI
    PageHeaderComponent
  ],
  templateUrl: './crear-colaborador.component.html',
  styleUrls: ['./crear-colaborador.component.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'crear-colaborador-page' }
})
export class CrearColaboradorComponent implements OnInit {

  // ===== Injections
  private colSvc = inject(ColaboradoresService);
  private cargaSvc = inject(CargaInicialService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  // ===== Estado base
  dataSource = new MatTableDataSource<Colaborador>([]);
  displayedColumns = ['nombre', 'documento', 'acciones'];
  colaboradores: Colaborador[] = [];

  nuevo: Colaborador = this.nuevoColaborador();
  editando = false;

  cargadosDesdeExcel: { nombre: string; documento: string }[] = [];

  cargando = false;
  guardando = false;

  // ===== Scroll helpers
  @ViewChild('formularioRef') formularioRef!: ElementRef;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private resaltadoId: number | null = null;

  // ===== Densidad
  density: Density = (localStorage.getItem('crearColab.density') as Density) || 'comfortable';
  @HostBinding('class.density-compact') get _isCompact() { return this.density === 'compact'; }
  @HostBinding('class.density-ultra') get _isUltra() { return this.density === 'ultra'; }
  setDensity(d: Density) { this.density = d; localStorage.setItem('crearColab.density', d); }

  // Header
  get subtitle(): string {
    const hoy = new Date();
    return `Actualizado al ${formatDate(hoy, "d 'de' MMMM 'de' y, h:mm a", 'es-CO')}`;
  }

  // ===== Ciclo de vida
  ngOnInit(): void {
    // ordenar por nombre por defecto (client-side)
    this.dataSource.sortingDataAccessor = (item, prop) => (item as any)[prop] ?? '';
    this.cargarTodo();
  }

  // ===== Carga principal
  cargarTodo(): void {
    this.cargando = true;
    this.colSvc.getAll().subscribe({
      next: (data) => {
        this.colaboradores = data || [];
        this.dataSource.data = this.colaboradores;
        if (this.paginator) this.dataSource.paginator = this.paginator;
        if (this.sort) this.dataSource.sort = this.sort;

        // Resaltar fila si venimos de editar/guardar
        setTimeout(() => this.resaltarFila(), 180);
      },
      error: () => this.toast('Error al cargar colaboradores'),
      complete: () => this.cargando = false
    });
  }

  // ===== Guardar/Editar
  guardar(): void {
    if (this.guardando) return;

    const { nombre, documento } = this.nuevo;
    if (!nombre?.trim() || !documento?.trim()) {
      this.toast('Debe completar nombre y documento');
      return;
    }

    this.guardando = true;
    const op$ = this.editando && this.nuevo.id
      ? this.colSvc.update(this.nuevo.id, this.nuevo)
      : this.colSvc.saveBasico({ nombre: nombre.trim(), documento: documento.trim() });

    if (this.nuevo.id) this.resaltadoId = this.nuevo.id;

    op$.subscribe({
      next: () => {
        this.toast(this.editando ? '✅ Colaborador actualizado.' : '✅ Colaborador creado.', true);
        this.cancelar(false);
        this.cargarTodo();
        // llevar vista al formulario (feedback)
        setTimeout(() => this.scrollForm(), 120);
      },
      error: () => this.toast('Error al guardar colaborador.'),
      complete: () => this.guardando = false
    });
  }

  editar(col: Colaborador): void {
    this.nuevo = { ...col };
    this.editando = true;
    this.resaltadoId = col.id ?? null;
    this.scrollForm();
  }

  eliminar(id?: number): void {
    if (!id) return;
    this.confirmar('¿Eliminar colaborador?', 'Esta acción no se puede deshacer.')
      .then(ok => {
        if (!ok) return;
        this.colSvc.delete(id).subscribe({
          next: () => { this.toast('🗑️ Colaborador eliminado.', true); this.cargarTodo(); },
          error: () => this.toast('Error al eliminar colaborador.')
        });
      });
  }

  cancelar(resetScroll = true): void {
    this.nuevo = this.nuevoColaborador();
    this.editando = false;
    if (resetScroll) this.scrollForm();
  }

  // ===== Excel
  subirExcel(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const bstr: string = e.target.result;
      const wb: XLSX.WorkBook = XLSX.read(bstr, { type: 'binary' });
      const wsname: string = wb.SheetNames[0];
      const ws: XLSX.WorkSheet = wb.Sheets[wsname];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      this.cargadosDesdeExcel = rows.map(r => ({
        nombre: (r.Nombre ?? '').toString().trim(),
        documento: String(r.Documento ?? '').trim()
      })).filter(x => x.nombre && x.documento);
      this.toast(`📥 ${this.cargadosDesdeExcel.length} filas preparadas.`);
    };
    reader.readAsBinaryString(file);
  }

  cargarDesdeExcel(): void {
    if (!this.cargadosDesdeExcel.length) return;
    this.cargaSvc.saveCargaInicial(this.cargadosDesdeExcel).subscribe({
      next: () => {
        this.toast('✅ Colaboradores importados correctamente.', true);
        this.cargadosDesdeExcel = [];
        this.cargarTodo();
      },
      error: () => this.toast('Error al importar colaboradores.')
    });
  }

  // ===== Helpers UI / UX
  private scrollForm(): void {
    setTimeout(() => this.formularioRef?.nativeElement?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    }), 40);
  }

  private resaltarFila(): void {
    if (this.resaltadoId == null) return;
    const tr = document.querySelector(`tr[data-id='${this.resaltadoId}']`);
    if (tr) {
      tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
      tr.classList.add('resaltado');
      setTimeout(() => tr.classList.remove('resaltado'), 1800);
    }
    this.resaltadoId = null;
  }

  private toast(msg: string, ok = false) {
    this.snack.open(msg, ok ? 'OK' : 'Cerrar', { duration: ok ? 2200 : 3500 });
  }

  private confirmar(title: string, message: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title, message, confirmText: 'Confirmar', cancelText: 'Cancelar' }
    });
    return firstValueFrom(ref.afterClosed()).then(v => !!v);
  }

  // ===== Modelo base (no tocar contratos)
  private nuevoColaborador(): Colaborador {
    return {
      id: undefined,
      nombre: '',
      documento: '',
      rol: '',
      grupo: '',
      maquinas: [],
      puedeReemplazar: [],
      turnoId: undefined,
      maquinaId: undefined,
      puestoId: undefined,
      domingos: []
    };
  }
}
