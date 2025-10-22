// colaboradores.component.ts (Material PRO)
import { Component, OnInit, ViewEncapsulation, HostBinding, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

// Material
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

// App
import { ColaboradoresService } from 'src/app/core/services/colaboradores.service';
import { RolesService } from 'src/app/core/services/roles.service';
import { PuestosService } from 'src/app/core/services/puestos.service';
import { MaquinasService } from 'src/app/core/services/maquinas.service';
import { Colaborador } from 'src/app/core/models/colaborador.model';
import { ColaboradorDetallado } from 'src/app/core/models/colaborador-detallado.model';
import { Rol } from 'src/app/core/models/rol.model';
import { Puesto } from 'src/app/core/models/puesto.model';
import { Maquina } from 'src/app/core/models/maquina.model';
import { FiltroColaboradoresPipe } from 'src/app/shared/pipes/filtro-colaboradores.pipe';
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { ConfirmDialogComponent } from 'src/app/features/programacion/dialogs/confirm-dialog.component';
import { GrupoDisplayPipe } from 'src/app/shared/pipes/grupo-display.pipe';

type Density = 'comfortable' | 'compact' | 'ultra';

@Component({
  selector: 'app-colaboradores',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    // Material
    MatButtonModule, MatIconModule, MatSnackBarModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCheckboxModule, MatSlideToggleModule, MatDialogModule,
    MatProgressBarModule, MatTooltipModule, MatButtonToggleModule,
    // UI
    PageHeaderComponent, FiltroColaboradoresPipe, GrupoDisplayPipe
  ],
  templateUrl: './colaboradores.component.html',
  styleUrls: ['./colaboradores.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'colaboradores-page' }
})
export class ColaboradoresComponent implements OnInit {

  // === Injections
  private colaboradoresService = inject(ColaboradoresService);
  private rolesService = inject(RolesService);
  private puestosService = inject(PuestosService);
  private maquinasService = inject(MaquinasService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  // === Data
  colaboradores: (ColaboradorDetallado & { seleccionado?: boolean })[] = [];
  roles: Rol[] = [];
  puestos: Puesto[] = [];
  maquinas: Maquina[] = [];
  grupos: string[] = ['Titular', 'Y1', 'Y2'];
  turnosGrupo: string[] = [];

  coordinadoresDisponibles: ColaboradorDetallado[] = [];
  coordinadoresAsignados: { id: number, nombre: string }[] = [];

  // === Estado
  seleccionarTodos = false;
  cargando = false;
  loading = true;
  fullscreenLoading = false;

  // Filtros
  filtroNombre = '';
  filtroPuedeReemplazarRol: Rol | null = null;
  filtroGrupo: string | null = null;
  filtroMaquinaPrincipal: Maquina | null = null;
  filtroCoordinadorId: number | null = null;
  filtroSinAsignacion = false;
  filtrosAbiertos = false;

  // Form edición
  nuevo: ColaboradorDetallado = this.limpiar();
  editando = false;
  grupoAnterior = '';
  sinMaquinaPrincipal = false;

  // Reasignación
  modoReasignacion = false;

  // Densidad
  density: Density = (localStorage.getItem('colaboradores.density') as Density) || 'comfortable';
  @HostBinding('class.density-compact') get _isCompact() { return this.density === 'compact'; }
  @HostBinding('class.density-ultra') get _isUltra() { return this.density === 'ultra'; }
  setDensity(d: Density) { this.density = d; localStorage.setItem('colaboradores.density', d); }

  // UI helpers
  @ViewChild('formularioEdicion') formularioRef!: ElementRef;
  compareById = (a: any, b: any) => a && b && a.id === b.id;

  // Header
  get subtitle(): string {
    const hoy = new Date();
    return `Actualizado al ${formatDate(hoy, "d 'de' MMMM 'de' y, h:mm a", 'es-CO')}`;
  }

  // ===== Ciclo de vida
  ngOnInit(): void {
    this.loading = true;

    // Cargar catálogos en paralelo, luego colaboradores
    this.rolesService.getAll().subscribe({ next: d => this.roles = d });
    this.puestosService.getAll().subscribe({ next: d => this.puestos = d });
    this.maquinasService.getAll().subscribe({ next: d => this.maquinas = d });

    this.colaboradoresService.getTurnosGrupoPorGrupo('TITULAR').subscribe({
      next: turnos => this.turnosGrupo = (turnos || []).map(t => t.horario),
      error: () => this.toast('Error al cargar Turnos Grupo TITULAR.')
    });

    this.cargarColaboradores();
  }

  // ===== Toasts / Diálogos
  private toast(msg: string, ok = false) {
    this.snack.open(msg, ok ? 'OK' : 'Cerrar', { duration: ok ? 2200 : 3500 });
  }

  private confirmar(mensaje: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: 'Confirmación', message: mensaje, confirmText: 'Confirmar', cancelText: 'Cancelar' }
    });
    return firstValueFrom(ref.afterClosed()).then(res => !!res);
  }

  // ===== Carga principal
  cargarColaboradores(): void {
    this.colaboradoresService.getDetallado().subscribe({
      next: data => {
        this.colaboradores = (data || []).map(c => ({ ...c, seleccionado: false }));

        // Coordinadores disponibles (puestos COORDINADOR, grupo TITULAR)
        this.coordinadoresDisponibles = this.colaboradores.filter(c =>
          c.puesto?.nombre?.toUpperCase() === 'COORDINADOR' && c.grupo?.toUpperCase() === 'TITULAR'
        );

        // Coordinadores actualmente asignados en la data
        this.coordinadoresAsignados = this.colaboradores
          .filter(c => c.coordinadorId && c.coordinadorNombre)
          .reduce((acc, curr) => {
            if (!acc.some(x => x.id === curr.coordinadorId)) acc.push({ id: curr.coordinadorId!, nombre: curr.coordinadorNombre! });
            return acc;
          }, [] as { id: number, nombre: string }[]);

        // Verificaciones de coordinadores
        this.verificarGruposSinCoordinador();
        this.loading = false;
      },
      error: () => { this.loading = false; this.toast('Error al cargar colaboradores.'); }
    });
  }

  verificarGruposSinCoordinador(): void {
    this.colaboradoresService.getGruposSinCoordinador().subscribe({
      next: grupos => {
        const totalTitulares = this.colaboradores.filter(c =>
          c.puesto?.nombre?.toUpperCase() === 'COORDINADOR' && c.grupo?.toUpperCase() === 'TITULAR'
        ).length;

        if (grupos.includes('TITULAR')) {
          this.toast('⚠️ No hay ningún coordinador en el grupo TITULAR.');
          return;
        }
        if (totalTitulares < 3) {
          const faltan = 3 - totalTitulares;
          this.toast(faltan === 1 ? 'Falta 1 coordinador titular en el sistema.' : `Faltan ${faltan} coordinadores titulares en el sistema.`);
        }
      },
      error: () => this.toast('Error al verificar los grupos sin coordinador.')
    });
  }

  // ===== Utilidades
  getNombresMaquinas(m: Maquina[] = []): string { return (m ?? []).map(x => x.nombre).join(', '); }
  getNombresRoles(r: Rol[] = []): string { return (r ?? []).map(x => x.nombre).join(', '); }
  trackById = (_: number, item: ColaboradorDetallado) => item.id!;

  // ===== Edición
  editar(col: ColaboradorDetallado): void {
    this.grupoAnterior = col.grupo?.toUpperCase() ?? '';
    this.nuevo = {
      ...col,
      grupo: this.grupoAnterior, // normalizado
      maquinas: [...(col.maquinas || [])],
      puedeReemplazar: [...(col.puedeReemplazar || [])],
    };
    this.editando = true;
    this.sinMaquinaPrincipal = !col.maquina;

    setTimeout(() => this.formularioRef?.nativeElement?.scrollIntoView({ behavior: 'smooth' }), 60);
  }

  eliminar(id: number): void {
    this.confirmar('¿Eliminar colaborador?').then(ok => {
      if (!ok) return;
      this.fullscreenLoading = true;
      this.colaboradoresService.delete(id).subscribe({
        next: () => { this.toast('🗑️ Colaborador eliminado.', true); this.cargarColaboradores(); },
        error: () => this.toast('Error al eliminar colaborador.'),
        complete: () => this.fullscreenLoading = false
      });
    });
  }

  cancelar(): void {
    this.nuevo = this.limpiar();
    this.editando = false;
    this.modoReasignacion = false;
    this.sinMaquinaPrincipal = false;
  }

  limpiar(): ColaboradorDetallado {
    return {
      id: 0, nombre: '', documento: '', grupo: '',
      rol: null!, puesto: null!, maquina: null!,
      maquinas: [], puedeReemplazar: [],
      coordinadorId: undefined, tieneTurnoFijo: false, turnoFijo: ''
    };
  }

  isTitular(grupo: string | undefined): boolean {
    return (grupo ?? '').toUpperCase() === 'TITULAR';
  }

  onGrupoChange(): void {
    const grupoActual = this.nuevo.grupo?.toUpperCase();
    if (this.editando && grupoActual !== this.grupoAnterior && this.grupoAnterior === 'TITULAR') {
      // si sale de TITULAR, limpiar máquina principal
      this.confirmar(`Grupo cambiado a ${grupoActual}. ¿Eliminar máquina principal?`).then(ok => {
        if (ok) this.nuevo.maquina = null;
        this.grupoAnterior = grupoActual || '';
      });
    } else {
      this.grupoAnterior = grupoActual || '';
    }
  }

  // ===== Guardar
  guardar(): void {
    if (this.cargando) return;
    this.cargando = true;

    const nombre = this.nuevo.nombre?.trim();
    const documento = this.nuevo.documento?.trim();
    const grupo = (this.nuevo.grupo ?? '').toUpperCase();

    if (!nombre || !documento) { this.cargando = false; return this.toast('Nombre y documento son obligatorios.'); }
    if (!['TITULAR', 'Y1', 'Y2'].includes(grupo)) { this.cargando = false; return this.toast(`Grupo inválido: "${grupo}".`); }

    const esTitular = this.isTitular(grupo);
    const esCoordinador = this.nuevo.puesto?.nombre?.toUpperCase() === 'COORDINADOR';

    if (esTitular && !this.sinMaquinaPrincipal && !this.nuevo.maquina) {
      this.cargando = false; return this.toast('Debe asignar una máquina principal al grupo TITULAR o marcar "Sin máquina principal".');
    }
    if (esTitular && !this.nuevo.puesto) {
      this.cargando = false; return this.toast('Debe asignar un puesto al grupo TITULAR.');
    }
    if (esTitular && !this.nuevo.coordinadorId) {
  const tieneTurnoFijoActivo = this.nuevo.tieneTurnoFijo && !!this.nuevo.turnoFijo;
  const esPrimerCoordinadorTitular =
    esCoordinador &&
    this.colaboradores.filter(c =>
      c.puesto?.nombre?.toUpperCase() === 'COORDINADOR' &&
      c.grupo?.toUpperCase() === 'TITULAR'
    ).length === 0;

  if (!tieneTurnoFijoActivo && !esPrimerCoordinadorTitular) {
    this.cargando = false;
    return this.toast('Debes asignar un coordinador al grupo TITULAR o habilitar un turno fijo.');
  }
}

    if (this.sinMaquinaPrincipal) this.nuevo.maquina = null;

    if (esTitular && esCoordinador) {
      const total = this.colaboradores.filter(c =>
        c.puesto?.nombre?.toUpperCase() === 'COORDINADOR' && c.grupo?.toUpperCase() === 'TITULAR' &&
        (!this.editando || c.id !== this.nuevo.id)
      ).length;
      if (total >= 3) {
        this.cargando = false;
        return this.toast('Ya existen 3 coordinadores en TITULAR.');
      }
    }

    if (esCoordinador && esTitular) this.nuevo.coordinadorId = this.nuevo.id ?? null;
    if (esCoordinador && !esTitular) {
      this.nuevo.puesto = null;
      this.nuevo.coordinadorId = undefined;
      this.toast('Ya no pertenece al grupo TITULAR. Se eliminó el puesto de COORDINADOR.');
    }
    if (!esTitular) this.nuevo.maquina = null;

    // turno fijo
    if (!this.nuevo.tieneTurnoFijo) this.nuevo.turnoFijo = '';
    if (esTitular && this.nuevo.tieneTurnoFijo && !this.nuevo.turnoFijo) {
      this.cargando = false; return this.toast('Debe seleccionar un horario para el turno fijo.');
    }

    const payload: Colaborador = {
      id: this.nuevo.id,
      nombre, documento, grupo,
      rol: this.nuevo.rol?.nombre, rolId: this.nuevo.rol?.id,
      puesto: this.nuevo.puesto?.nombre, puestoId: this.nuevo.puesto?.id,
      maquina: this.nuevo.maquina?.nombre, maquinaId: this.nuevo.maquina?.id,
      maquinas: (this.nuevo.maquinas ?? []).map(m => m.nombre),
      puedeReemplazar: (this.nuevo.puedeReemplazar ?? []).map(r => r.nombre),
      coordinadorId: this.nuevo.coordinadorId,
      domingos: [],
      turnoFijo: this.nuevo.turnoFijo,
      tieneTurnoFijo: this.nuevo.tieneTurnoFijo ?? false,
    };

    const idEditado = this.nuevo.id;
    const req$ = this.editando && this.nuevo.id
      ? this.colaboradoresService.update(this.nuevo.id, payload)
      : this.colaboradoresService.save(payload);

    req$.subscribe({
      next: () => {
        this.cancelar();
        // refrescar data + highlight
        this.colaboradoresService.getDetallado().subscribe({
          next: data => {
            this.colaboradores = (data || []).map(c => ({ ...c, seleccionado: false }));
            this.coordinadoresDisponibles = this.colaboradores.filter(c =>
              c.puesto?.nombre?.toUpperCase() === 'COORDINADOR' && c.grupo?.toUpperCase() === 'TITULAR'
            );
            this.coordinadoresAsignados = this.colaboradores
              .filter(c => c.coordinadorId && c.coordinadorNombre)
              .reduce((acc, curr) => {
                if (!acc.some(x => x.id === curr.coordinadorId)) acc.push({ id: curr.coordinadorId!, nombre: curr.coordinadorNombre! });
                return acc;
              }, [] as { id: number, nombre: string }[]);
            this.verificarGruposSinCoordinador();

            setTimeout(() => {
              const fila = document.querySelector(`tr[data-id='${idEditado}']`);
              if (fila) {
                fila.scrollIntoView({ behavior: 'smooth', block: 'center' });
                fila.classList.add('resaltado');
                setTimeout(() => fila.classList.remove('resaltado'), 2000);
              }
            }, 200);

            this.toast('✅ Cambios guardados.', true);
          }
        });
      },
      error: err => {
        const msg = typeof err?.error === 'string' ? err.error : (err?.error?.message || 'Error al guardar colaborador.');
        this.toast(msg);
        this.cargando = false;
      },
      complete: () => this.cargando = false
    });
  }

  // ===== Reasignación masiva
  activarModoReasignacion(): void {
    this.modoReasignacion = true;
    this.seleccionarTodos = false;
    this.colaboradores.forEach(c => c.seleccionado = false);
  }
  toggleSeleccionarTodos(): void {
    this.colaboradores.forEach(c => c.seleccionado = this.seleccionarTodos);
  }
  getNombreCoordinadorSeleccionado(): string {
    const c = this.coordinadoresDisponibles.find(x => x.id === this.nuevo.coordinadorId);
    return c ? c.nombre : '...';
  }
  confirmarReasignacion(): void {
    const seleccionados = this.colaboradores.filter(c => c.seleccionado);
    if (seleccionados.length === 0) return this.toast('Selecciona al menos un colaborador.');
    if (this.nuevo.coordinadorId == null) return this.toast('Selecciona el nuevo coordinador.');

    this.confirmar(`¿Reasignar ${seleccionados.length} colaboradores al coordinador seleccionado?`).then(ok => {
      if (!ok) return;
      const request = {
        idsColaboradores: seleccionados.map(c => c.id!),
        nuevoCoordinadorId: this.nuevo.coordinadorId!
      };
      this.fullscreenLoading = true;
      this.colaboradoresService.reasignarCoordinador(request).subscribe({
        next: () => {
          this.toast(`✅ ${seleccionados.length} colaboradores reasignados correctamente.`, true);
          this.cargarColaboradores();
          this.modoReasignacion = false;
        },
        error: err => {
          const mensaje = typeof err?.error === 'string' ? err.error : (err?.error?.message || '❌ Error al reasignar colaboradores.');
          this.toast(mensaje);
        },
        complete: () => this.fullscreenLoading = false
      });
    });
  }

  get filtrosActivos(): number {
    let n = 0;
    if (this.filtroNombre?.trim()) n++;
    if (this.filtroPuedeReemplazarRol) n++;
    if (this.filtroGrupo) n++;
    if (this.filtroMaquinaPrincipal) n++;
    if (this.filtroCoordinadorId) n++;
    if (this.filtroSinAsignacion) n++;
    return n;
  }

  limpiarFiltros(): void {
    this.filtroNombre = '';
    this.filtroPuedeReemplazarRol = null;
    this.filtroGrupo = null;
    this.filtroMaquinaPrincipal = null;
    this.filtroCoordinadorId = null;
    this.filtroSinAsignacion = false;
  }
}
