import { Component, OnInit, ViewEncapsulation, HostBinding, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

// Angular Material
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';

// App
import { ExcelExportService } from 'src/app/core/services/excel-export.service';
import { ProgramacionService } from 'src/app/core/services/programacion.service';
import { Asignacion } from 'src/app/core/models/asignacion.model';
import { IfRolesDirective } from 'src/app/shared/directives/if-roles.directive';
import { AuthService } from 'src/app/core/services/auth.service';
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { ConfirmDialogComponent } from './dialogs/confirm-dialog.component';
import { GenerarSemanaDialogComponent } from './dialogs/generar-semana-dialog.component';

type Density = 'comfortable' | 'compact' | 'ultra';

@Component({
  selector: 'app-programacion-semanal',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    // Material
    MatButtonModule, MatIconModule, MatSnackBarModule, MatDialogModule, MatProgressBarModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonToggleModule,
    // Otros
    PageHeaderComponent, IfRolesDirective
  ],
  templateUrl: './programacion-semanal.component.html',
  styleUrls: ['./programacion-semanal.component.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'programacion-semanal-page' }
})
export class ProgramacionSemanalComponent implements OnInit {
  private programacionService = inject(ProgramacionService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private auth = inject(AuthService);
  private excel = inject(ExcelExportService);

  asignaciones: Asignacion[] = [];

  lunesInicio = '';
  sabadoFin = '';
  semanaActual!: Date;
  cargando = false;

  /** Loader pantalla completa */
  fullscreenLoading = false;

  /** Densidad UI */
  density: Density = (localStorage.getItem('prog.density') as Density) || 'comfortable';
  @HostBinding('class.density-compact') get _isCompact() { return this.density === 'compact'; }
  @HostBinding('class.density-ultra') get _isUltra() { return this.density === 'ultra'; }
  setDensity(d: Density) {
    this.density = d;
    localStorage.setItem('prog.density', d);
  }

  turnos: string[] = ['06:00-14:00', '14:00-22:00', '22:00-06:00'];
  maquinas: string[] = [];

  coordinadoresPorTurno: { [turno: string]: string } = {};
  turnoParaEditar: { turno: string, coordinadorNombre: string } | null = null;
  modoEdicionTurnos = false;
  turnosEditados: { [coordinador: string]: string } = {};

  filtroTexto = '';
  filtroNombre = '';

  // defaults para el diálogo de generación
  checkboxManana = true;
  checkboxNoche = false;

  ngOnInit(): void {
    this.semanaActual = this.obtenerLunesDeSemana(new Date());
    this.actualizarFechasYDatos();
  }

  /** Subtítulo formateado */
  get subtitle(): string {
    const fmt = "d 'de' MMMM 'de' y";
    const inicio = formatDate(this.lunesInicio, fmt, 'es-CO');
    const fin = formatDate(this.sabadoFin, fmt, 'es-CO');
    return `Del Lunes ${inicio} al Sábado ${fin}`;
  }

  // ===== UI helpers =====
  private mostrarAlerta(msg: string): void {
    this.snack.open(msg, 'OK', { duration: 3500 });
  }

  private abrirConfirmacion(mensaje: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Confirmación', message: mensaje, confirmText: 'Confirmar', cancelText: 'Cancelar' }
    });
    return firstValueFrom(ref.afterClosed());
  }

  private async mostrarConfirmacionGenerarSemana(): Promise<void> {
    if (!this.auth.hasAnyRole(['SUPERVISOR', 'ADMIN'])) {
      this.snack.open('No autorizado para generar semana automáticamente.', 'OK', { duration: 3000 });
      return;
    }
    const ref = this.dialog.open(GenerarSemanaDialogComponent, {
      data: {
        mensaje: `No hay asignaciones para la semana del ${this.lunesInicio}. ¿Deseas generarlas automáticamente?`,
        checkboxManana: this.checkboxManana,
        checkboxNoche: this.checkboxNoche
      }
    });
    const result = await firstValueFrom(ref.afterClosed());
    if (!result?.confirmed) return;

    this.cargando = true;
    this.fullscreenLoading = true;
    const sub = this.programacionService.generarProgramacion(this.lunesInicio, result.mode).subscribe({
      next: (msg) => {
        this.mostrarAlerta(`✅ Semana generada correctamente: ${msg}`);
        this.obtenerAsignacionesPorSemana();
      },
      error: (err) => {
        console.error('❌ Error al generar semana:', err);
        this.mostrarAlerta('❌ No se pudo generar la programación.');
        this.cargando = false;
      }
    });
    sub.add(() => this.fullscreenLoading = false);
  }

  // ===== Navegación semana =====
  cambiarSemana(direccion: number): void {
    const nuevaFecha = new Date(this.semanaActual);
    nuevaFecha.setDate(nuevaFecha.getDate() + 7 * direccion);
    this.semanaActual = this.obtenerLunesDeSemana(nuevaFecha);
    this.actualizarFechasYDatos();
  }

  actualizarFechasYDatos(): void {
    this.lunesInicio = this.formatearFechaISO(this.semanaActual);
    this.sabadoFin = this.formatearFechaISO(new Date(this.semanaActual.getTime() + 5 * 86400000));
    this.obtenerAsignacionesPorSemana();
  }

  obtenerAsignacionesPorSemana(): void {
    this.cargando = true;
    this.programacionService.obtenerAsignacionesPorFecha(this.lunesInicio).subscribe({
      next: async (data: Asignacion[]) => {
        if (!data || data.length === 0) {
          this.cargando = false;
          this.checkboxManana = true;
          this.checkboxNoche = false;
          if (this.auth.hasAnyRole(['SUPERVISOR', 'ADMIN'])) {
            await this.mostrarConfirmacionGenerarSemana();
          } else {
            this.snack.open('No hay asignaciones esta semana.', 'OK', { duration: 2500 });
          }
          return;
        }

        this.asignaciones = data;

        const sinMaquina = new Set(
          data.filter(a => !a.maquinaNombre && !this.esCoordinador(a))
            .map(a => a.puestoNombre || 'SIN CLASIFICAR')
        );
        const conMaquina = new Set(
          data.filter(a => !!a.maquinaNombre).map(a => a.maquinaNombre!)
        );

        this.maquinas = [
          ...Array.from(sinMaquina).sort(),
          ...Array.from(conMaquina).sort()
        ];

        this.coordinadoresPorTurno = {};
        for (const a of data) {
          if (a.puestoNombre?.toUpperCase() === 'COORDINADOR') {
            this.coordinadoresPorTurno[a.turno] = a.colaboradorNombre;
          }
        }

        this.cargando = false;
      },
      error: (err) => {
        console.error('❌ Error al cargar asignaciones:', err);
        this.mostrarAlerta('❌ Error al cargar la programación semanal.');
        this.cargando = false;
      }
    });
  }

  generarSemana(): void {
    if (!this.auth.hasAnyRole(['SUPERVISOR', 'ADMIN'])) {
      this.snack.open('No autorizado', 'OK', { duration: 2500 });
      return;
    }
    this.cargando = true;
    this.fullscreenLoading = true;
    const sub = this.programacionService.generarProgramacion(this.lunesInicio).subscribe({
      next: (msg) => {
        this.mostrarAlerta(`✅ Semana generada correctamente: ${msg}`);
        this.obtenerAsignacionesPorSemana();
      },
      error: (err) => {
        console.error('❌ Error al generar semana:', err);
        this.mostrarAlerta('❌ No se pudo generar la programación.');
        this.cargando = false;
      }
    });
    sub.add(() => this.fullscreenLoading = false);
  }

  async confirmarRegenerarSemana(): Promise<void> {
    if (!this.auth.hasAnyRole(['SUPERVISOR', 'ADMIN'])) {
      this.snack.open('No autorizado', 'OK', { duration: 2500 });
      return;
    }
    const ok = await this.abrirConfirmacion(
      `¿Estás seguro de que deseas generar la semana del ${this.lunesInicio}? Esto eliminará cualquier programación existente.`
    );
    if (ok) this.generarSemana();
  }

  async eliminarTodo(): Promise<void> {
    if (!this.auth.hasAnyRole(['SUPERVISOR', 'ADMIN'])) {
      this.snack.open('No autorizado', 'OK', { duration: 2500 });
      return;
    }
    const ok = await this.abrirConfirmacion('⚠️ Esto eliminará TODAS las asignaciones del sistema. ¿Deseas continuar?');
    if (!ok) return;

    this.programacionService.eliminarTodaLaProgramacion().subscribe({
      next: (msg) => {
        this.mostrarAlerta(msg);
        this.obtenerAsignacionesPorSemana();
      },
      error: (err) => {
        console.error('❌ Error al eliminar toda la programación:', err);
        this.mostrarAlerta('❌ No se pudo eliminar toda la programación.');
      }
    });
  }

  async eliminarTodoSistema(): Promise<void> {
    if (!this.auth.hasRole('ADMIN')) {
      this.snack.open('Solo ADMIN puede realizar esta acción', 'OK', { duration: 3000 });
      return;
    }
    const ok = await this.abrirConfirmacion(
      '⚠️ Esto eliminará TODAS las programaciones (asignaciones, domingos y descansos Y1). ¿Deseas continuar?'
    );
    if (!ok) return;

    this.programacionService.eliminarTodoSistema().subscribe({
      next: (msg) => {
        this.mostrarAlerta(msg);
        this.obtenerAsignacionesPorSemana();
      },
      error: (err) => {
        console.error('❌ Error al eliminar todo el sistema:', err);
        this.mostrarAlerta('❌ No se pudo eliminar todo el sistema.');
      }
    });
  }

  async eliminarSemanaActual(): Promise<void> {
    if (!this.auth.hasAnyRole(['SUPERVISOR', 'ADMIN'])) {
      this.snack.open('No autorizado', 'OK', { duration: 2500 });
      return;
    }

    // ✅ construir fecha local, no usar new Date('YYYY-MM-DD')
    const [y, m, d] = this.lunesInicio.split('-').map(Number);
    const fecha = new Date(y, (m ?? 1) - 1, d ?? 1); // local midnight

    if (isNaN(fecha.getTime())) {
      this.mostrarAlerta('⚠️ Fecha inválida.');
      return;
    }
    if (fecha.getDay() !== 1) { // 1 = Lunes
      this.mostrarAlerta('⚠️ La fecha debe corresponder a un lunes.');
      return;
    }

    const ok = await this.abrirConfirmacion(
      `¿Eliminar TODAS las asignaciones de la semana iniciada en ${this.lunesInicio}?`
    );
    if (!ok) return;

    this.cargando = true;
    this.programacionService.eliminarSemana(this.lunesInicio).subscribe({
      next: (msg) => {
        this.mostrarAlerta(msg || '✅ Semana eliminada correctamente.');
        this.obtenerAsignacionesPorSemana();
      },
      error: (err) => {
        console.error('❌ Error al eliminar semana específica:', err);
        const mensaje = (err?.error as string) || '❌ No se pudo eliminar la semana.';
        this.mostrarAlerta(mensaje);
        this.cargando = false;
      },
    });
  }

  activarModoCambioTurnos(): void {
    if (!this.auth.hasAnyRole(['SUPERVISOR', 'ADMIN'])) {
      this.snack.open('No autorizado', 'OK', { duration: 2500 });
      return;
    }
    this.modoEdicionTurnos = true;
    this.turnosEditados = {};
    for (const turno of this.turnos) {
      const nombre = this.coordinadoresPorTurno[turno];
      if (nombre) this.turnosEditados[nombre] = turno;
    }
  }

  guardarCambiosTurnos(): void {
    if (!this.auth.hasAnyRole(['SUPERVISOR', 'ADMIN'])) {
      this.snack.open('No autorizado', 'OK', { duration: 2500 });
      return;
    }
    const turnosAsignados = Object.values(this.turnosEditados);
    const tieneDuplicados = new Set(turnosAsignados).size !== turnosAsignados.length;
    if (tieneDuplicados) {
      this.mostrarAlerta('❌ Cada coordinador debe tener un turno único.');
      return;
    }

    this.programacionService.cambiarTurnosCoordinadores(this.turnosEditados, this.lunesInicio).subscribe({
      next: () => {
        this.mostrarAlerta('✅ Turnos actualizados y semana regenerada correctamente.');
        this.modoEdicionTurnos = false;
        this.obtenerAsignacionesPorSemana();
      },
      error: (err) => {
        console.error('❌ Error al guardar cambios de turno:', err);
        const mensaje = err?.error || '❌ Ocurrió un error al aplicar los cambios.';
        this.mostrarAlerta(mensaje);
      }
    });
  }

  abrirModalCambioTurno(turno: string): void {
    if (!this.auth.hasAnyRole(['SUPERVISOR', 'ADMIN'])) {
      this.snack.open('No autorizado', 'OK', { duration: 2500 });
      return;
    }
    const coordinador = this.coordinadoresPorTurno[turno];
    this.turnoParaEditar = { turno, coordinadorNombre: coordinador };
  }

  confirmarCambioTurno(nuevoTurno: string): void {
    if (!this.auth.hasAnyRole(['SUPERVISOR', 'ADMIN'])) {
      this.snack.open('No autorizado', 'OK', { duration: 2500 });
      return;
    }
    if (!this.turnoParaEditar) return;

    this.programacionService.cambiarTurnoCoordinador(
      this.turnoParaEditar!.coordinadorNombre,
      nuevoTurno,
      this.lunesInicio
    ).subscribe({
      next: () => {
        this.mostrarAlerta('✅ Turno cambiado correctamente.');
        this.turnoParaEditar = null;
        this.obtenerAsignacionesPorSemana();
      },
      error: (err) => {
        console.error('❌ Error al cambiar turno:', err);
        this.mostrarAlerta('❌ No se pudo cambiar el turno.');
      }
    });
  }

  // ===== Helpers =====
  maquinasFiltradas(): string[] {
    const filtroMaquina = this.filtroTexto.trim().toLowerCase();
    const filtroNombre = this.filtroNombre.trim().toLowerCase();

    return this.maquinas.filter(nombreGrupo => {
      const coincideGrupo = !filtroMaquina || nombreGrupo.toLowerCase().includes(filtroMaquina);
      const hayCoincidenciaNombre = this.turnos.some(turno => {
        const colaboradores = this.getColaboradores(nombreGrupo, turno);
        return colaboradores.some(col =>
          !filtroNombre || col.colaboradorNombre.toLowerCase().includes(filtroNombre)
        );
      });
      return coincideGrupo && hayCoincidenciaNombre;
    });
  }

  getColaboradores(grupo: string, turno: string): Asignacion[] {
    return this.asignaciones.filter(a => {
      const agrupador = a.maquinaNombre ? this.normalizar(a.maquinaNombre) : this.normalizar(a.puestoNombre);
      return (
        agrupador === this.normalizar(grupo) &&
        a.turno === turno &&
        !this.esCoordinador(a) &&
        a.fecha === this.lunesInicio
      );
    });
  }

  getColaborador(grupo: string, turno: string): Asignacion | undefined {
    const normalizadoGrupo = this.normalizar(grupo);
    return this.asignaciones.find(a => {
      const agrupador = a.maquinaNombre ? this.normalizar(a.maquinaNombre) : this.normalizar(a.puestoNombre);
      return (
        agrupador === normalizadoGrupo &&
        a.turno === turno &&
        a.puestoNombre?.toUpperCase() !== 'COORDINADOR' &&
        a.fecha === this.lunesInicio
      );
    });
  }

  obtenerLunesDeSemana(fecha: Date): Date {
    const dia = fecha.getDay();
    const diferencia = (dia + 6) % 7;
    const lunes = new Date(fecha);
    lunes.setDate(fecha.getDate() - diferencia);
    lunes.setHours(0, 0, 0, 0);
    return lunes;
  }

  formatearFechaISO(fecha: Date): string {
    return fecha.toISOString().split('T')[0];
  }

  esCoordinador(a: Asignacion): boolean {
    return a.puestoNombre?.trim().toLowerCase() === 'coordinador';
  }

  esMaquina(nombre: string): boolean {
    return this.asignaciones.some(a => a.maquinaNombre?.toLowerCase() === nombre.toLowerCase());
  }

  getBadgeClass(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n === 'mecanico') return 'badge bg-info text-dark';
    if (n === 'pulidor') return 'badge bg-warning text-dark';
    return 'badge bg-secondary';
  }

  private normalizar(valor: string | null | undefined): string {
    return (valor || 'SIN CLASIFICAR').trim().toLowerCase();
  }
  // helper para construir la celda exactamente como en la UI
  private cellProg(grupo: string, turno: string): string[] {
    return this.getColaboradores(grupo, turno).map(col =>
      `${col.colaboradorNombre}${col.tieneTurnoFijo ? ' 🔒' : ''} (${col.puestoNombre})`
    );
  }

  exportarExcel(): void {
    const grupos = this.maquinasFiltradas();

    this.excel.exportProgramacionSemanal({
      titulo: 'Programación semanal',
      subtitulo: `Del ${formatDate(this.lunesInicio, "d 'de' MMMM 'de' y", 'es-CO')} al ${formatDate(this.sabadoFin, "d 'de' MMMM 'de' y", 'es-CO')}`,
      turnos: this.turnos,
      grupos,
      // 👉 igual a la UI: nombre en negrita, puesto en segunda línea, 🔒 si tiene turno fijo
      getCeldaRich: (g, t) =>
        this.getColaboradores(g, t).map(col => ({
          nombre: col.colaboradorNombre,
          puesto: col.puestoNombre || '',
          fijo: !!col.tieneTurnoFijo
        })),
      // “chips” para la primera columna
      getBadge: (g) =>
        this.esMaquina(g)
          ? null
          : (this.getBadgeClass(g)?.includes('info')
            ? 'MECANICO'
            : this.getBadgeClass(g)?.includes('warning')
              ? 'PULIDOR'
              : 'PUESTO'),
      coordinadoresPorTurno: this.coordinadoresPorTurno,
      filename: `Programacion_${this.lunesInicio}.xlsx`,
    });
  }

}
