// src/app/core/services/programacion.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ProgramacionSemanal } from '../models/programacion-semanal.model';
import { Asignacion } from '../models/asignacion.model';

@Injectable({ providedIn: 'root' })
export class ProgramacionService {
  private apiUrl = `${environment.apiUrl}/programacion-semanal`;

  constructor(private http: HttpClient) { }

  obtenerProgramacion(coordinadorId: number, fechaInicio: string): Observable<ProgramacionSemanal[]> {
    const params = new HttpParams()
      .set('coordinadorId', coordinadorId)
      .set('semanaInicio', fechaInicio); // YYYY-MM-DD

    return this.http.get<ProgramacionSemanal[]>(`${this.apiUrl}/semanal`, { params });
  }

  generarProgramacion(
    lunes: string,
    modoDomingo: 'LUNES' | 'SABADO' | 'AMBOS' | 'NINGUNO' = 'LUNES'
  ): Observable<string> {
    const params = new HttpParams()
      .set('lunes', lunes)
      .set('modoDomingo', modoDomingo);

    return this.http.post(`${this.apiUrl}/generar`, null, {
      params,
      responseType: 'text' // backend devuelve String
    });
  }

  eliminarTodaLaProgramacion(): Observable<string> {
    return this.http.delete(`${this.apiUrl}/eliminar-todo`, {
      responseType: 'text'
    });
  }

  eliminarTodoSistema(): Observable<string> {
    return this.http.delete(`${this.apiUrl}/eliminar-todo-sistema`, {
      responseType: 'text'
    });
  }

  // PUT: /api/programacion-semanal/cambiar-turno
  cambiarTurnoCoordinador(nombreCoordinador: string, nuevoTurno: string, lunes: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/cambiar-turno`, {
      nombreCoordinador,
      nuevoTurno,
      lunes
    });
  }

  cambiarTurnosCoordinadores(turnosPorCoordinador: { [coordinador: string]: string }, lunes: string): Observable<void> {
    const payload = {
      lunes,
      turnosPorCoordinador
    };

    return this.http.put<void>(`${this.apiUrl}/cambiar-turnos`, payload);
  }


  obtenerAsignacionesPorFecha(lunes: string): Observable<Asignacion[]> {
    const params = new HttpParams().set('lunes', lunes);
    return this.http.get<Asignacion[]>(`${environment.apiUrl}/programacion-semanal/por-fecha`, { params });
  }

  eliminarSemana(lunes: string): Observable<string> {
    const params = new HttpParams().set('lunes', lunes);
    return this.http.delete(`${this.apiUrl}/eliminar-semana`, {
      params,
      responseType: 'text'
    });
  }


}
