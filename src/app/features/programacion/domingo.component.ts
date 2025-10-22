import { Component, OnInit, ViewEncapsulation, HostBinding, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

// App
import { ExcelExportService } from 'src/app/core/services/excel-export.service';
import { DomingoService } from 'src/app/core/services/domingo.service';
import { DomingoConColaboradoresDTO, ColaboradorDomingoDTO } from 'src/app/core/models/domingo.model';
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { IfRolesDirective } from 'src/app/shared/directives/if-roles.directive';

type Density = 'comfortable' | 'compact' | 'ultra';

@Component({
  selector: 'app-domingo',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    // Material
    MatButtonModule, MatIconModule, MatSnackBarModule, MatProgressBarModule,
    MatFormFieldModule, MatInputModule, MatButtonToggleModule,
    // UI
    PageHeaderComponent,
    IfRolesDirective
  ],
  templateUrl: './domingo.component.html',
  styleUrls: ['./domingo.component.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'domingo-page' }
})
export default class DomingoComponent implements OnInit {
  private domingoService = inject(DomingoService);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private excel = inject(ExcelExportService);

  domingos: DomingoConColaboradoresDTO[] = [];
  domingoActual!: DomingoConColaboradoresDTO; // se mantiene tu contrato
  filtroTexto = '';
  filtroNombre = '';

  turnos: string[] = ['06:00-14:00', '14:00-22:00', '22:00-06:00'];
  maquinas: string[] = [];
  coordinadoresPorTurno: { [turno: string]: string } = {};

  isLoading = false;
  errorMessage = '';

  /** Densidad UI (igual patrón que Programación Semanal) */
  density: Density = (localStorage.getItem('domingo.density') as Density) || 'comfortable';
  @HostBinding('class.density-compact') get _isCompact() { return this.density === 'compact'; }
  @HostBinding('class.density-ultra') get _isUltra() { return this.density === 'ultra'; }
  setDensity(d: Density) { this.density = d; localStorage.setItem('domingo.density', d); }

  /** Índices para performance O(1) */
  private idx = new Map<string, ColaboradorDomingoDTO[]>();
  private gruposMaquina = new Set<string>();
  private key(grupo: string, turno: string) { return `${(grupo || '').toLowerCase()}|${turno}`; }

  ngOnInit(): void {
    this.cargarDomingos();
  }

  /** Subtítulo bonito como en Programación */
  get subtitle(): string {
    if (!this.domingoActual?.fecha) return '';
    const fmt = "d 'de' MMMM 'de' y";
    const fecha = formatDate(this.domingoActual.fecha, fmt, 'es-CO');
    return `Domingo ${fecha}`;
  }

  editarDomingo(): void {
    if (!this.domingoActual?.fecha) return;
    this.router.navigate(['/domingo/editar'], { queryParams: { fecha: this.domingoActual.fecha } });
  }

  cargarDomingos(): void {
    this.isLoading = true;
    this.domingoService.obtenerDomingosConColaboradores().subscribe({
      next: (data) => {
        this.domingos = (data || []).sort((a, b) =>
          new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        );

        if (this.domingos.length > 0) {
          // 📅 Obtener el domingo de la semana actual (tu misma lógica)
          const hoy = new Date();
          const diaSemana = hoy.getDay(); // 0 = domingo
          const diferencia = diaSemana === 0 ? 0 : 7 - diaSemana;
          const domingoActualFecha = new Date(hoy);
          domingoActualFecha.setDate(hoy.getDate() + diferencia - 7);
          domingoActualFecha.setHours(0, 0, 0, 0);

          const domingoEncontrado = this.domingos.find(d => {
            const fechaDomingo = new Date(d.fecha);
            fechaDomingo.setHours(0, 0, 0, 0);
            return fechaDomingo.getTime() === domingoActualFecha.getTime();
          });

          this.domingoActual = domingoEncontrado
            ? domingoEncontrado
            : (this.domingos.find(d => new Date(d.fecha) <= domingoActualFecha) || this.domingos[0]);

          this.organizarMaquinasYCoordinadores();
        } else {
          // Mantenemos tu contrato
          this.domingoActual = undefined as any;
          this.maquinas = [];
        }

        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error al cargar domingos:', err);
        this.errorMessage = 'Error al cargar los domingos.';
        this.isLoading = false;
        this.snack.open(this.errorMessage, 'OK', { duration: 3000 });
      }
    });
  }

  cambiarDomingo(direccion: number): void {
    const actualIndex = this.domingos.findIndex(d => d.fecha === this.domingoActual.fecha);
    const nuevoIndex = actualIndex + direccion;
    if (nuevoIndex >= 0 && nuevoIndex < this.domingos.length) {
      this.domingoActual = this.domingos[nuevoIndex];
      this.organizarMaquinasYCoordinadores();
    }
  }

  organizarMaquinasYCoordinadores(): void {
    if (!this.domingoActual) return;

    const sinMaquina = new Set(
      this.domingoActual.colaboradores
        .filter(c => !c.maquina && !this.esCoordinador(c))
        .map(c => c.puesto || 'SIN CLASIFICAR')
    );

    const conMaquina = new Set(
      this.domingoActual.colaboradores
        .filter(c => !!c.maquina)
        .map(c => c.maquina!)
    );

    this.maquinas = [
      ...Array.from(sinMaquina).sort(),
      ...Array.from(conMaquina).sort()
    ];

    // coordinadores por turno
    this.coordinadoresPorTurno = {};
    for (const c of this.domingoActual.colaboradores) {
      if (this.esCoordinador(c)) {
        this.coordinadoresPorTurno[c.turno] = c.nombre;
      }
    }

    // 🔧 reconstruir índices para celdas O(1)
    this.idx.clear();
    this.gruposMaquina.clear();

    for (const c of this.domingoActual.colaboradores) {
      if (c.maquina) this.gruposMaquina.add(c.maquina.toLowerCase());
      const grupo = c.maquina || c.puesto || 'SIN CLASIFICAR';
      const k = this.key(grupo, c.turno);
      const arr = this.idx.get(k);
      if (arr) arr.push(c); else this.idx.set(k, [c]);
    }
  }

  maquinasFiltradas(): string[] {
    const filtroMaquina = this.filtroTexto.trim().toLowerCase();
    const filtroNombre = this.filtroNombre.trim().toLowerCase();

    return this.maquinas.filter(nombreGrupo => {
      const coincideGrupo = !filtroMaquina || nombreGrupo.toLowerCase().includes(filtroMaquina);
      const hayCoincidenciaNombre = this.turnos.some(turno => {
        const colaboradores = this.getColaboradores(nombreGrupo, turno);
        return colaboradores.some(col =>
          !filtroNombre || col.nombre.toLowerCase().includes(filtroNombre)
        );
      });
      return coincideGrupo && hayCoincidenciaNombre;
    });
  }

  getColaboradores(grupo: string, turno: string): ColaboradorDomingoDTO[] {
    if (!this.domingoActual) return [];
    const lista = this.idx.get(this.key(grupo, turno)) || [];
    return lista.filter(c => !this.esCoordinador(c));
  }

  esCoordinador(col: ColaboradorDomingoDTO): boolean {
    return col.puesto?.trim().toLowerCase() === 'coordinador';
  }

  esMaquina(nombre: string): boolean {
    return this.gruposMaquina.has(nombre.toLowerCase());
  }

  getBadgeClass(nombre: string): string {
    const normalizado = (nombre || '').toLowerCase();
    if (normalizado === 'mecanico') return 'badge bg-info text-dark';
    if (normalizado === 'pulidor') return 'badge bg-warning text-dark';
    return 'badge bg-secondary';
  } /** Construye el texto de celda exactamente como en la UI: "Nombre (Puesto)" */
  private cellDomingo(grupo: string, turno: string): string[] {
    return this.getColaboradores(grupo, turno).map(col => `${col.nombre} (${col.puesto})`);
  }

  /** Export a Excel con el mismo look & feel que Programación */
 
  exportarExcel(): void {
    if (!this.domingoActual) return;

    const grupos = this.maquinasFiltradas();

    // Chips de la 1ª columna (igual que en Programación)
    const getBadge = (g: string): ('MECANICO' | 'PULIDOR' | 'PUESTO') | null => {
      if (this.esMaquina(g)) return null;
      const cls = this.getBadgeClass(g);
      if (cls.includes('info')) return 'MECANICO';
      if (cls.includes('warning')) return 'PULIDOR';
      return 'PUESTO';
    };

    const titulo = 'Domingo';
    const subtitulo = this.subtitle || formatDate(this.domingoActual.fecha, "d 'de' MMMM 'de' y", 'es-CO');

    void this.excel.exportDomingo({
      titulo,
      subtitulo,
      turnos: this.turnos,
      grupos,
      // 👉 bonito: nombre en negrita + (puesto) en 2ª línea
      getCeldaRich: (g, t) =>
        this.getColaboradores(g, t).map(col => ({
          nombre: col.nombre,
          puesto: col.puesto || '',
          // si tienes un flag similar a “tieneTurnoFijo”, úsalo aquí; si no, déjalo undefined
          // fijo: !!col.tieneTurnoFijo
        })),
      getBadge,
      coordinadoresPorTurno: this.coordinadoresPorTurno,
      filename: `Domingo_${this.domingoActual.fecha}.xlsx`,
    });
  }

  // trackBy para rendimiento
  trackByGrupo = (_: number, g: string) => g;
  trackByTurno = (_: number, t: string) => t;
  trackByCol = (_: number, c: ColaboradorDomingoDTO) => `${c.nombre}|${c.puesto}|${c.turno}`;
}
