import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Turno } from '../models/turno.model';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class TurnosService {
  private api = environment.apiUrl + '/turnos';

  constructor(private http: HttpClient) { }

  // ✅ Obtener la programación semanal
  getProgramacionSemanal(): Observable<Turno[]> {
    return this.http.get<Turno[]>(`${this.api}/semanal`);
  }

  // ✅ Obtener todos los turnos existentes (opcional para carga inicial)
  getAll(): Observable<Turno[]> {
    return this.http.get<Turno[]>(this.api);
  }

  // ✅ Guardar nuevo turno
  save(turno: Turno): Observable<any> {
    return this.http.post(this.api, turno);
  }

  // ✅ Actualizar turno existente
  update(id: number, turno: Turno): Observable<any> {
    return this.http.put(`${this.api}/${id}`, turno);
  }

  // ✅ Eliminar turno
  delete(id: number): Observable<any> {
    return this.http.delete(`${this.api}/${id}`);
  }

  // ✅ Obtener turno por ID
  getById(id: number): Observable<Turno> {
    return this.http.get<Turno>(`${this.api}/${id}`);
  }
}
