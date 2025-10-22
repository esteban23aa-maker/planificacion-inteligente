import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Colaborador } from '../models/colaborador.model';
import { ColaboradorDetallado } from '../models/colaborador-detallado.model';
import { TurnoGrupoDTO } from '../models/turno-grupo.dto';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class ColaboradoresService {
  private apiUrl = `${environment.apiUrl}/colaboradores`;

  constructor(private http: HttpClient) { }

  /** Obtener lista simple de colaboradores */
  getAll(): Observable<Colaborador[]> {
    return this.http.get<Colaborador[]>(this.apiUrl);
  }

  /** Obtener lista detallada para frontend (con objetos anidados) */
  getDetallado(): Observable<ColaboradorDetallado[]> {
    return this.http.get<ColaboradorDetallado[]>(`${this.apiUrl}/detallado`);
  }

  /** Crear colaborador completo */
  save(colaborador: Colaborador): Observable<any> {
    return this.http.post(this.apiUrl, colaborador);
  }

  /** Actualizar colaborador existente */
  update(id: number, colaborador: Colaborador): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, colaborador);
  }

  /** Eliminar colaborador (limpia grupo si es coordinador) */
  delete(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  /** Obtener colaborador por ID */
  getById(id: number): Observable<Colaborador> {
    return this.http.get<Colaborador>(`${this.apiUrl}/${id}`);
  }

  /** Crear colaborador básico (solo nombre y documento) */
  saveBasico(colaborador: Partial<Colaborador>): Observable<any> {
    return this.http.post(`${this.apiUrl}/carga-inicial`, colaborador);
  }

  /** Nuevo: consultar grupos sin coordinador (TITULAR, Y1, Y2) */
  getGruposSinCoordinador(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/grupos-sin-coordinador`);
  }

  /** Reasignar múltiples colaboradores a un nuevo coordinador */
  reasignarCoordinador(request: { idsColaboradores: number[], nuevoCoordinadorId: number }): Observable<any> {
    return this.http.post(`${this.apiUrl}/reasignar-coordinador`, request);
  }

  getTurnosGrupo(): Observable<TurnoGrupoDTO[]> {
    return this.http.get<TurnoGrupoDTO[]>('/api/turno-grupos');

  }

  getTurnosGrupoPorGrupo(grupo: string): Observable<{ horario: string }[]> {
    return this.http.get<{ horario: string }[]>(`/api/turno-grupos/grupo/${grupo}`);
  }

}
