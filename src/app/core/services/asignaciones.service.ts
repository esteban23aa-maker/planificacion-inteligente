import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Asignacion } from '../models/asignacion.model';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { HttpParams } from '@angular/common/http';


@Injectable({ providedIn: 'root' })
export class AsignacionesService {
  private api = environment.apiUrl + '/asignaciones';

  constructor(private http: HttpClient) { }

  getAll(): Observable<Asignacion[]> {
    return this.http.get<Asignacion[]>(this.api);
  }

  // src/app/core/services/programacion.service.ts
  obtenerAsignacionesPorFecha(fechaInicio: string): Observable<Asignacion[]> {
    const params = new HttpParams().set('lunes', fechaInicio);
    return this.http.get<Asignacion[]>(`${environment.apiUrl}/programacion-semanal/por-fecha`, { params });
  }


  save(asignacion: Asignacion): Observable<Asignacion> {
    return this.http.post<Asignacion>(this.api, asignacion);
  }

  delete(id: number) {
    return this.http.delete(`${this.api}/${id}`);
  }

}
