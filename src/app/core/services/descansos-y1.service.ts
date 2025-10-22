// src/app/core/services/descansos-y1.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { TrabajadorDomingo, ReemplazoY1, DescansoY1, IncidenciaDTO } from '../models/descanso-y1.model';

@Injectable({ providedIn: 'root' })
export class DescansosY1Service {
  private apiUrl = `${environment.apiUrl}/v1/descanso-y1`;

  constructor(private http: HttpClient) { }

  getTrabajadores(domingo?: string): Observable<TrabajadorDomingo[]> {
    const url = domingo ? `${this.apiUrl}/trabajadores?domingo=${domingo}` : `${this.apiUrl}/trabajadores`;
    return this.http.get<TrabajadorDomingo[]>(url);
  }

  getReemplazos(domingo?: string): Observable<ReemplazoY1[]> {
    const url = domingo ? `${this.apiUrl}/reemplazos?domingo=${domingo}` : `${this.apiUrl}/reemplazos`;
    return this.http.get<ReemplazoY1[]>(url);
  }

  getDomingosDisponibles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/semanas/disponibles`);
  }

  getDomingoAnterior(desde: string): Observable<string> {
    return this.http.get<string>(`${this.apiUrl}/semanas/anterior?desde=${desde}`);
  }

  getDomingoSiguiente(desde: string): Observable<string> {
    return this.http.get<string>(`${this.apiUrl}/semanas/siguiente?desde=${desde}`);
  }

  // Listar descansos
  getDescansos(domingo?: string): Observable<DescansoY1[]> {
    const url = domingo ? `${this.apiUrl}/listar?domingo=${domingo}` : `${this.apiUrl}/listar`;
    return this.http.get<DescansoY1[]>(url);
  }

  // Generar descansos
  generarDescansos(domingo: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/generar?domingoBase=${domingo}`, {});
  }

  // Eliminar TODOS los descansos de una semana
  eliminarDescansos(domingo: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/eliminar?domingoBase=${domingo}`);
  }

  // ⚡ NUEVO: Reset SOLO del colaborador en la semana (opción incluirManuales)
  // src/app/core/services/descansos-y1.service.ts
  resetSemanaColaborador(
    domingo: string, colaboradorId: number, incluirManuales = false, regenerar = true
  ) {
    const q = `domingoBase=${domingo}&colaboradorId=${colaboradorId}&incluirManuales=${incluirManuales}&regenerar=${regenerar}`;
    return this.http.delete<IncidenciaDTO[]>(`${this.apiUrl}/eliminar/colaborador?${q}`);
  }

  // atajo cómodo: quitar sin regenerar
  quitarSemanaColaborador(domingo: string, colaboradorId: number, incluirManuales = false) {
    return this.resetSemanaColaborador(domingo, colaboradorId, incluirManuales, /*regenerar*/ false);
  }

  // eliminar UN descanso por id
  eliminarDescanso(id: number) {
    return this.http.delete<IncidenciaDTO[]>(`${this.apiUrl}/descanso/${id}`);
  }


  // Mover descanso
  moverDescanso(id: number, nuevaFecha: string, forzar = false): Observable<IncidenciaDTO[]> {
    return this.http.patch<IncidenciaDTO[]>(
      `${this.apiUrl}/descanso/${id}/mover?nuevaFecha=${nuevaFecha}&forzar=${forzar}`, {}
    );
  }

  // Intercambiar descansos
  intercambiarDescansos(idA: number, idB: number, forzar = false): Observable<IncidenciaDTO[]> {
    return this.http.post<IncidenciaDTO[]>(
      `${this.apiUrl}/descanso/intercambiar?idA=${idA}&idB=${idB}&forzar=${forzar}`, {}
    );
  }

  // Rebalancear semana
  rebalancearSemana(domingo: string): Observable<IncidenciaDTO[]> {
    return this.http.post<IncidenciaDTO[]>(
      `${this.apiUrl}/rebalancear?domingoBase=${domingo}`, {}
    );
  }

  // Incidencias
  listarIncidencias(domingo: string): Observable<IncidenciaDTO[]> {
    return this.http.get<IncidenciaDTO[]>(
      `${this.apiUrl}/incidencias?domingoBase=${domingo}`
    );
  }
}
