import {
  Component, OnInit, ViewEncapsulation, ViewChildren, QueryList, ElementRef, ViewChild, HostBinding, inject
} from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin, firstValueFrom } from 'rxjs';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

// App
import { DomingoService } from 'src/app/core/services/domingo.service';
import { ColaboradoresService } from 'src/app/core/services/colaboradores.service';
import { MaquinasService } from 'src/app/core/services/maquinas.service';
import { PuestosService } from 'src/app/core/services/puestos.service';
import { DomingoConColaboradoresDTO, ColaboradorDomingoDTO } from 'src/app/core/models/domingo.model';
import { Colaborador } from 'src/app/core/models/colaborador.model';
import { Maquina } from 'src/app/core/models/maquina.model';
import { Puesto } from 'src/app/core/models/puesto.model';

// UI
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { ConfirmDialogComponent } from './dialogs/confirm-dialog.component';

// Ng-select (se mantiene para búsqueda cómoda)
import { NgSelectModule } from '@ng-select/ng-select';

type Density = 'comfortable' | 'compact' | 'ultra';
type EditableCol = ColaboradorDomingoDTO & { maquinaId: number | null; puestoId: number | null };

@Component({
  selector: 'app-domingo-edicion',
  standalone: true,
  imports: [
    CommonModule, FormsModule, NgSelectModule,
    // Material
    MatButtonModule, MatIconModule, MatSnackBarModule, MatProgressBarModule,
    MatFormFieldModule, MatInputModule, MatDialogModule, MatButtonToggleModule, MatTooltipModule,
    // UI
    PageHeaderComponent,
  ],
  templateUrl: './domingo-edicion.component.html',
  styleUrls: ['./domingo-edicion.component.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'domingo-edicion-page' }
})
export class DomingoEdicionComponent implements OnInit {
  private domingoService = inject(DomingoService);
  private colaboradoresService = inject(ColaboradoresService);
  private maquinasService = inject(MaquinasService);
  private puestosService = inject(PuestosService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  domingo!: DomingoConColaboradoresDTO;
  colaboradores: EditableCol[] = [];

  turnosDisponibles = ['06:00-14:00', '14:00-22:00', '22:00-06:00'];
  errores: string[] = [];
  isLoading = false;

  nombresDisponibles: Colaborador[] = [];
  maquinasDisponibles: Maquina[] = [];
  puestosDisponibles: Puesto[] = [];

  @ViewChildren('colaboradorRow') filasColaboradores!: QueryList<ElementRef>;
  @ViewChild('formularioColaborador') formularioColaborador!: ElementRef;

  filtroTexto = '';
  filtroNombre = '';
  coordinadoresPorTurno: { [turno: string]: string } = {};


  // Densidad (coincide con otros módulos)
  density: Density = (localStorage.getItem('domingo-ed.density') as Density) || 'comfortable';
  @HostBinding('class.density-compact') get _isCompact() { return this.density === 'compact'; }
  @HostBinding('class.density-ultra') get _isUltra() { return this.density === 'ultra'; }
  setDensity(d: Density) { this.density = d; localStorage.setItem('domingo-ed.density', d); }

  // Form temporal (edición/alta)
  nuevoColaborador: Partial<EditableCol> = {
    id: undefined,
    nombre: '',
    turno: '06:00-14:00',
    maquinaId: null,
    puestoId: null,
    tipoAsignacion: 'MANUAL'
  };
  editandoNuevo = false;
  colaboradorEditandoIndex: number | null = null;

  ngOnInit(): void {
    const fechaParam = this.route.snapshot.queryParamMap.get('fecha');
    if (!fechaParam) {
      this.snack.open('La fecha del domingo no fue especificada.', 'OK', { duration: 3000 });
      this.router.navigate(['/domingo']);
      return;
    }

    this.isLoading = true;
    forkJoin({
      domingo: this.domingoService.obtenerDomingoPorFecha(fechaParam),
      colaboradores: this.colaboradoresService.getAll(),
      maquinas: this.maquinasService.getAll(),
      puestos: this.puestosService.getAll()
    }).subscribe({
      next: ({ domingo, colaboradores, maquinas, puestos }) => {
        this.domingo = domingo;
        this.nombresDisponibles = colaboradores;
        this.maquinasDisponibles = maquinas;
        this.puestosDisponibles = puestos;

        // Normaliza ids (evita undefined -> null)
        this.colaboradores = (domingo.colaboradores || []).map((c): EditableCol => {
          const m = maquinas.find(x => x.nombre === c.maquina)?.id ?? null;
          const p = puestos.find(x => x.nombre === c.puesto)?.id ?? null;
          const maquinaId = (c as any).maquinaId ?? m ?? null;
          const puestoId = (c as any).puestoId ?? p ?? null;
          return { ...c, maquinaId, puestoId };
        });

        // Coordinadores por turno
        this.coordinadoresPorTurno = {};
        for (const col of this.colaboradores) {
          if (this.esCoordinador(col)) this.coordinadoresPorTurno[col.turno] = col.nombre;
        }

        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        this.snack.open('Error al cargar datos: ' + (err.error?.message || err.message), 'OK', { duration: 3500 });
        this.router.navigate(['/domingo']);
      }
    });
  }

  // Header
  get subtitle(): string {
    const f = this.domingo?.fecha;
    return f ? formatDate(f, "EEEE d 'de' MMMM 'de' y", 'es-CO') : '';
  }

  // Filtros/listado
  maquinasFiltradas(): string[] {
    const fm = this.filtroTexto.trim().toLowerCase();
    const fn = this.filtroNombre.trim().toLowerCase();

    const sinMaquina = new Set(
      this.colaboradores
        .filter(c => !c.maquina && !this.esCoordinador(c))
        .map(c => c.puesto || 'SIN CLASIFICAR')
    );

    const conMaquina = new Set(
      this.colaboradores
        .filter(c => !!c.maquina)
        .map(c => c.maquina!)
    );

    const ordenados = [
      ...Array.from(sinMaquina).sort(),
      ...Array.from(conMaquina).sort()
    ];

    return ordenados.filter(grupo => {
      const coincideGrupo = !fm || grupo.toLowerCase().includes(fm);
      const hayCoincidenciaNombre = this.turnosDisponibles.some(t =>
        this.getColaboradores(grupo, t).some(col => !fn || col.nombre.toLowerCase().includes(fn))
      );
      return coincideGrupo && hayCoincidenciaNombre;
    });
  }


  getColaboradores(grupo: string, turno: string): EditableCol[] {
    const g = (grupo || 'SIN CLASIFICAR').toLowerCase();
    return this.colaboradores.filter(c => {
      const agrupador = (c.maquina || c.puesto || 'SIN CLASIFICAR').toLowerCase();
      return agrupador === g && c.turno === turno && !this.esCoordinador(c);
    });
  }

  esCoordinador(col: ColaboradorDomingoDTO): boolean {
    return col.puesto?.trim().toLowerCase() === 'coordinador';
  }

  esMaquina(nombre: string): boolean {
    return this.maquinasDisponibles.some(m => m.nombre.toLowerCase() === (nombre || '').toLowerCase());
  }

  getBadgeClass(nombre: string): string {
    const n = (nombre || '').toLowerCase();
    if (n === 'mecanico') return 'badge bg-info text-dark';
    if (n === 'pulidor') return 'badge bg-warning text-dark';
    return 'badge bg-secondary';
  }

  // Edición inline
  eliminarColaborador(index: number): void {
    this.colaboradores.splice(index, 1);
  }

  eliminarColaboradorPorId(id: number): void {
    this.colaboradores = this.colaboradores.filter(c => c.id !== id);
  }

  editarColaborador(col: EditableCol): void {
    const idx = this.colaboradores.findIndex(c => c.id === col.id);
    this.colaboradorEditandoIndex = idx;

    this.nuevoColaborador = {
      id: col.id,
      nombre: col.nombre,
      turno: col.turno,
      maquinaId: col.maquinaId ?? (this.maquinasDisponibles.find(m => m.nombre === col.maquina)?.id ?? null),
      puestoId: col.puestoId ?? (this.puestosDisponibles.find(p => p.nombre === col.puesto)?.id ?? null),
      tipoAsignacion: col.tipoAsignacion || 'MANUAL'
    };
    this.editandoNuevo = true;

    setTimeout(() => {
      if (this.formularioColaborador) {
        this.formularioColaborador.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 40);
  }

  agregarColaborador(): void {
    this.editandoNuevo = true;
    this.colaboradorEditandoIndex = null;
    this.nuevoColaborador = {
      id: undefined,
      nombre: '',
      turno: '06:00-14:00',
      maquinaId: null,
      puestoId: null,
      tipoAsignacion: 'MANUAL'
    };
  }

  onColaboradorSeleccionado(): void {
    const sel = this.nombresDisponibles.find(c => c.id === this.nuevoColaborador.id);
    if (sel) this.nuevoColaborador.nombre = sel.nombre;
  }

 confirmarAgregarColaborador(): void {
  if (!this.nuevoColaborador.id || !this.nuevoColaborador.turno) {
    this.snack.open('Completa nombre y turno.', 'OK', { duration: 2500 });
    return;
  }

  const maquinaNombre =
  this.maquinasDisponibles.find(m => m.id === this.nuevoColaborador.maquinaId)?.nombre || '';

  const puestoNombre = this.puestosDisponibles.find(p => p.id === this.nuevoColaborador.puestoId)?.nombre || '';
  const coordPuestoId = this.getCoordinadorPuestoId();

  // ========== CASO ESPECIAL: COORDINADOR ==========
  if (this.nuevoColaborador.puestoId && coordPuestoId && this.nuevoColaborador.puestoId === coordPuestoId) {
    const turno = this.nuevoColaborador.turno!;
    const nuevoId = this.nuevoColaborador.id!;
    const nuevoNombre = this.nuevoColaborador.nombre || (this.nombresDisponibles.find(n => n.id === nuevoId)?.nombre ?? '');

    // 1) eliminar coordinador previo del mismo turno (unicidad)
    this.colaboradores = this.colaboradores.filter(c => !(this.esCoordinador(c) && c.turno === turno));

    // 2) si la persona ya existe en la tabla, CONVERTIR su puesto a Coordinador
    const existenteIndex = this.colaboradores.findIndex(c => c.id === nuevoId);
    if (existenteIndex >= 0) {
      this.colaboradores[existenteIndex] = {
        ...this.colaboradores[existenteIndex],
        nombre: nuevoNombre,
        turno: turno,
        maquina: '',         // coordinador normalmente sin máquina (ajústalo si quieres heredar)
        puesto: puestoNombre || 'Coordinador',
        maquinaId: null,
        puestoId: coordPuestoId,
        tipoAsignacion: 'MANUAL'
      };
    } else {
      // 3) si no existe, agregarlo como Coordinador
      this.colaboradores.push({
        id: nuevoId,
        nombre: nuevoNombre,
        turno: turno,
        maquina: '',         // coordinador sin máquina
        puesto: puestoNombre || 'Coordinador',
        maquinaId: null,
        puestoId: coordPuestoId,
        tipoAsignacion: 'MANUAL'
      });
    }

    // 4) refrescar cabecera de coordinadores
    this.setCoordinadorNombreCache(turno);

    // finalizar UI
    this.editandoNuevo = false;
    this.colaboradorEditandoIndex = null;

    // resaltado opcional
    setTimeout(() => {
      const fila = this.filasColaboradores?.find(el =>
        el.nativeElement.textContent.includes(nuevoNombre)
      );
      if (fila) {
        fila.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        fila.nativeElement.classList.add('resaltado');
        setTimeout(() => fila.nativeElement.classList.remove('resaltado'), 1500);
      }
    }, 40);

    return; // ← IMPORTANTE: no seguir al flujo estándar
  }

  // ========== FLUJO ESTÁNDAR (tu código original) ==========
  if (this.colaboradorEditandoIndex !== null) {
    this.colaboradores[this.colaboradorEditandoIndex] = {
      id: this.nuevoColaborador.id!,
      nombre: this.nuevoColaborador.nombre!,
      turno: this.nuevoColaborador.turno!,
      maquina: maquinaNombre,
      puesto: puestoNombre,
      maquinaId: this.nuevoColaborador.maquinaId ?? null,
      puestoId: this.nuevoColaborador.puestoId ?? null,
      tipoAsignacion: this.nuevoColaborador.tipoAsignacion || 'MANUAL'
    };
    this.colaboradorEditandoIndex = null;
  } else {
    if (this.colaboradores.some(c => c.id === this.nuevoColaborador.id)) {
      this.snack.open('Ese colaborador ya está asignado.', 'OK', { duration: 2500 });
      return;
    }
    this.colaboradores.push({
      id: this.nuevoColaborador.id!,
      nombre: this.nuevoColaborador.nombre!,
      turno: this.nuevoColaborador.turno!,
      maquina: maquinaNombre,
      puesto: puestoNombre,
      maquinaId: this.nuevoColaborador.maquinaId ?? null,
      puestoId: this.nuevoColaborador.puestoId ?? null,
      tipoAsignacion: this.nuevoColaborador.tipoAsignacion || 'MANUAL'
    });
  }

  this.editandoNuevo = false;

  setTimeout(() => {
    const fila = this.filasColaboradores.find(el =>
      el.nativeElement.textContent.includes(this.nuevoColaborador.nombre || '')
    );
    if (fila) {
      fila.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fila.nativeElement.classList.add('resaltado');
      setTimeout(() => fila.nativeElement.classList.remove('resaltado'), 1500);
    }
  }, 40);
}


  cancelarAgregar(): void {
    this.editandoNuevo = false;
    this.colaboradorEditandoIndex = null;
  }

  // Validación/guardar
  private validarAsignaciones(): boolean {
    this.errores = [];
    const ids = new Set<number>();

    for (const col of this.colaboradores) {
      if (!col.nombre || !col.turno) this.errores.push(`Colaborador con datos incompletos.`);
      if (ids.has(col.id)) this.errores.push(`Colaborador duplicado: ${col.nombre}`);
      if (col.turno && !this.turnosDisponibles.includes(col.turno)) {
        this.errores.push(`Turno inválido para ${col.nombre}: ${col.turno}`);
      }
      ids.add(col.id);
    }

    if (this.errores.length) {
      this.snack.open(this.errores.join(' • '), 'OK', { duration: 3500 });
      return false;
    }
    return true;
  }

  async guardarCambios(): Promise<void> {
    if (!this.domingo) return;
    if (!this.validarAsignaciones()) return;

    const ok = await this.abrirConfirmacion('¿Deseas guardar los cambios en este domingo?');
    if (!ok) return;

    this.isLoading = true;
    const payload = this.colaboradores.map(col => ({
      colaboradorId: col.id,
      turno: col.turno,
      tipoAsignacion: col.tipoAsignacion || 'MANUAL',
      maquinaId: col.maquinaId ?? (this.maquinasDisponibles.find(m => m.nombre === col.maquina)?.id ?? null),
      puestoId: col.puestoId ?? (this.puestosDisponibles.find(p => p.nombre === col.puesto)?.id ?? null)
    }));

    this.domingoService.actualizarAsignaciones(this.domingo.id, payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.snack.open('Cambios guardados exitosamente.', 'OK', { duration: 2500 });
        this.router.navigate(['/domingo']);
      },
      error: (err: any) => {
        this.isLoading = false;
        const msg = err?.error?.message || err?.message || 'Error desconocido';
        this.snack.open('Error al guardar: ' + msg, 'OK', { duration: 3500 });
      }
    });
  }

  // ===== Helpers Coordinador =====
private getCoordinadorPuestoId(): number | null {
  const p = this.puestosDisponibles.find(x =>
    (x.nombre || '').trim().toLowerCase() === 'coordinador'
  );
  return p?.id ?? null;
}

private getCoordinadorEntry(turno: string): EditableCol | undefined {
  return this.colaboradores.find(c => this.esCoordinador(c) && c.turno === turno);
}

private setCoordinadorNombreCache(turno: string) {
  const coord = this.getCoordinadorEntry(turno);
  if (coord) this.coordinadoresPorTurno[turno] = coord.nombre;
  else delete this.coordinadoresPorTurno[turno];
}

editarCoordinador(turno: string): void {
  const coordPuestoId = this.getCoordinadorPuestoId();
  if (!coordPuestoId) {
    this.snack.open('No existe el puesto "Coordinador" en catálogos.', 'OK', { duration: 3500 });
    return;
  }

  const actual = this.getCoordinadorEntry(turno);
  this.editandoNuevo = true;
  this.colaboradorEditandoIndex = actual
    ? this.colaboradores.findIndex(c => c.id === actual.id && c.turno === turno && this.esCoordinador(c))
    : null;

  this.nuevoColaborador = {
    id: actual?.id,                      // si ya hay, viene preseleccionado
    nombre: actual?.nombre || '',
    turno: turno,                        // forzado al turno de cabecera
    maquinaId: null,                     // coordinador sin máquina por defecto (puedes ajustar)
    puestoId: coordPuestoId,             // 🔒 forzamos "Coordinador"
    tipoAsignacion: 'MANUAL'
  };

  setTimeout(() => {
    if (this.formularioColaborador) {
      this.formularioColaborador.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 40);
}

quitarCoordinador(turno: string): void {
  const actual = this.getCoordinadorEntry(turno);
  if (!actual) {
    this.snack.open(`No hay coordinador en ${turno}.`, 'OK', { duration: 2200 });
    return;
  }
  // remueve esa asignación del array (no toca backend aún; backend se enterará al guardar)
  this.colaboradores = this.colaboradores.filter(c => !(this.esCoordinador(c) && c.turno === turno));
  this.setCoordinadorNombreCache(turno);
  this.snack.open(`Coordinador quitado de ${turno}.`, 'OK', { duration: 1800 });
}

setSinMaquina(): void {
  this.nuevoColaborador.maquinaId = null;
  // opcional: feedback rápido
  this.snack.open('Máquina desasignada para este colaborador.', 'OK', { duration: 1400 });
}

onMaquinaChange(_id: number | null): void {
  // Si el usuario limpió, garantizamos null consistente
  if (_id == null) this.nuevoColaborador.maquinaId = null;
}



  async cancelar(): Promise<void> {
    const ok = await this.abrirConfirmacion('¿Cancelar los cambios? Se perderán los datos no guardados.');
    if (ok) this.router.navigate(['/domingo']);
  }

  private abrirConfirmacion(message: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Confirmación', message, confirmText: 'Confirmar', cancelText: 'Cancelar' }
    });
    return firstValueFrom(ref.afterClosed());
  }

  // trackBy
  trackByGrupo = (_: number, g: string) => g;
  trackByTurno = (_: number, t: string) => t;
  trackByCol = (_: number, c: EditableCol) => `${c.id}|${c.turno}`;
}



