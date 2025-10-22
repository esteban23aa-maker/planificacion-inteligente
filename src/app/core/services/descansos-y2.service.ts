// C:\Proyectos\planificacion-inteligente\src\app\core\services\descansos-y2.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';
import { DescansoY2, ReemplazoY2, IncidenciaY2 } from '../models/descanso-y2.model';

@Injectable({ providedIn: 'root' })
export class DescansosY2Service {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/descanso-y2`;

  getDomingoAnterior(desdeISO: string) {
    const params = new HttpParams().set('desde', desdeISO);
    return this.http.get<string>(`${this.base}/domingos/anterior`, { params });
  }

  getDomingoSiguiente(desdeISO: string) {
    const params = new HttpParams().set('desde', desdeISO);
    return this.http.get<string>(`${this.base}/domingos/siguiente`, { params });
  }

  getReemplazos(domingoISO?: string): Observable<ReemplazoY2[]> {
    const params = domingoISO ? new HttpParams().set('domingo', domingoISO) : undefined;
    return this.http.get<ReemplazoY2[]>(`${this.base}/reemplazos`, { params });
  }

  getDescansos(domingoISO?: string): Observable<DescansoY2[]> {
    const params = domingoISO ? new HttpParams().set('domingo', domingoISO) : undefined;
    return this.http.get<DescansoY2[]>(`${this.base}/descansos`, { params });
  }

  generar(domingoISO?: string) {
    const params = domingoISO ? new HttpParams().set('domingo', domingoISO) : undefined;
    return this.http.post<void>(`${this.base}/generar`, null, { params });
  }

  eliminar(domingoISO: string) {
    const params = new HttpParams().set('domingo', domingoISO);
    return this.http.delete<void>(`${this.base}`, { params });
  }

  // Asignación manual parcial
  asignarManual(payload: {
    colaboradorId: number;
    fecha: string; // ISO
    horas: number; // 1..8
    puestoId?: number | null;
    maquinaId?: number | null;
    turno?: string | null;
  }) {
    return this.http.post<void>(`${this.base}/manual`, payload);
  }

  backlog(colaboradorId: number, domingoISO?: string) {
    const params = domingoISO ? new HttpParams().set('domingo', domingoISO) : undefined;
    return this.http.get<{ colaboradorId: number; horasPendientes: number }>(
      `${this.base}/backlog/${colaboradorId}`, { params }
    );
  }

  getIncidencias(domingoISO?: string): Observable<IncidenciaY2[]> {
    const base = `${environment.apiUrl}/v1/incidencias-y2`;
    return this.http.get<IncidenciaY2[]>(`${base}/${domingoISO}`);
  }

}
