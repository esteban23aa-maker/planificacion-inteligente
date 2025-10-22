import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HttpResponse } from '@angular/common/http';

import { environment } from 'src/environments/environment';
import { DomingoConColaboradoresDTO, ColaboradorDomingoDTO, AsignacionDomingoDTO } from '../models/domingo.model';

@Injectable({
  providedIn: 'root',
})
export class DomingoService {
  private apiUrl = `${environment.apiUrl}/domingos`;

  constructor(private http: HttpClient) { }

  obtenerDomingosConColaboradores(): Observable<DomingoConColaboradoresDTO[]> {
    return this.http.get<DomingoConColaboradoresDTO[]>(`${this.apiUrl}/colaboradores`);
  }

  obtenerDomingoPorFecha(fecha: string): Observable<DomingoConColaboradoresDTO> {
    return this.http.get<DomingoConColaboradoresDTO>(`${this.apiUrl}/${fecha}`);
  }

  actualizarAsignaciones(id: number, asignaciones: AsignacionDomingoDTO[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}/asignaciones`, asignaciones, {
      responseType: 'text' as 'json' // 👈 evita parsear respuesta vacía
    });
  }
}
