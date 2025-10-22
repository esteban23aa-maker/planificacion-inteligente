import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ColaboradoresService } from 'src/app/core/services/colaboradores.service';
import { TurnosService } from 'src/app/core/services/turnos.service';
import { Colaborador } from 'src/app/core/models/colaborador.model';
import { Turno } from 'src/app/core/models/turno.model';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

interface TurnoGrupo {
  id?: number;
  grupo: string;
  horario: string;
  activo: boolean;
}

@Component({
  selector: 'app-crear-turno',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crear-turno.component.html',
  styleUrls: ['./crear-turno.component.css']
})
export class CrearTurnoComponent implements OnInit {
  turnos: Turno[] = [];
  colaboradores: Colaborador[] = [];
  horariosGrupo: TurnoGrupo[] = [];

  nuevo = this.nuevoTurno();
  nuevoHorarioGrupo = this.nuevoTurnoGrupo();

  grupos: string[] = ['Titular', 'Y1', 'Y2'];

  private apiGrupo = environment.apiUrl + '/turno-grupos';

  constructor(
    private turnosService: TurnosService,
    private colaboradoresService: ColaboradoresService,
    private http: HttpClient
  ) { }

  ngOnInit(): void {
    this.colaboradoresService.getAll().subscribe(c => this.colaboradores = c);
    this.cargarTurnos();
    this.cargarHorariosGrupo();
  }

  cargarTurnos(): void {
    this.turnosService.getProgramacionSemanal().subscribe(t => this.turnos = t);
  }

  cargarHorariosGrupo(): void {
    this.http.get<TurnoGrupo[]>(this.apiGrupo).subscribe(data => this.horariosGrupo = data);
  }

  guardar(): void {
    if (!this.nuevo.fecha || !this.nuevo.horario || !this.nuevo.colaboradorId) {
      alert('Completa todos los campos');
      return;
    }

    this.turnosService.save(this.nuevo).subscribe(() => {
      this.cancelar();
      this.cargarTurnos();
    });
  }

  cancelar(): void {
    this.nuevo = this.nuevoTurno();
  }

  guardarHorarioGrupo(): void {
    if (!this.nuevoHorarioGrupo.grupo || !this.nuevoHorarioGrupo.horario) {
      alert('Completa grupo y horario');
      return;
    }

    this.http.post(this.apiGrupo, this.nuevoHorarioGrupo).subscribe({
      next: () => {
        this.nuevoHorarioGrupo = this.nuevoTurnoGrupo();
        this.cargarHorariosGrupo();
      },
      error: err => alert(err?.error || 'Error al guardar horario')
    });
  }

  eliminarHorarioGrupo(id: number): void {
    if (confirm('¿Eliminar este horario del grupo?')) {
      this.http.delete(`${this.apiGrupo}/${id}`).subscribe(() => this.cargarHorariosGrupo());
    }
  }

  getNombreColaborador(id: number | null | undefined): string {
    if (id == null) return 'Sin asignar';
    const col = this.colaboradores.find(c => c.id === id);
    return col ? `${col.nombre} (${col.documento})` : 'N/A';
  }


  private nuevoTurno(): Turno {
    return {
      fecha: '',
      horario: '',
      colaboradorId: null,
      activo: true,
      colaborador: {} as Colaborador
    };
  }

  private nuevoTurnoGrupo(): TurnoGrupo {
    return {
      grupo: '',
      horario: '',
      activo: true
    };
  }
}
