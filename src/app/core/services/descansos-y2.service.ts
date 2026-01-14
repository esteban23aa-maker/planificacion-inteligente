// C:\Proyectos\planificacion-inteligente\src\app\core\services\descansos-y2.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';
import { DescansoY2, ReemplazoY2, IncidenciaY2 } from '../models/descanso-y2.model';

export type Y2GenModo = 'NOCHE' | 'MANANA' | 'TARDE' | 'TURNO_FIJO' | 'GRUPO_Y2' | 'GRUPO_Y1';

@Injectable({ providedIn: 'root' })
export class DescansosY2Service {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/v1/descanso-y2`;

  getDomingoAnterior(desdeISO: string): Observable<string> {
    const params = new HttpParams().set('desde', desdeISO);
    return this.http.get<string>(`${this.base}/domingos/anterior`, { params });
  }

  getDomingoSiguiente(desdeISO: string): Observable<string> {
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

  // Generación "clásica" (todo junto) — sigue usando ?domingo=...
  generar(domingoISO?: string): Observable<void> {
    const params = domingoISO ? new HttpParams().set('domingo', domingoISO) : undefined;
    return this.http.post<void>(`${this.base}/generar`, null, { params });
  }

  eliminar(domingoISO: string): Observable<void> {
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
  }): Observable<void> {
    return this.http.post<void>(`${this.base}/manual`, payload);
  }

  backlog(colaboradorId: number, domingoISO?: string): Observable<{ colaboradorId: number; horasPendientes: number }> {
    const params = domingoISO ? new HttpParams().set('domingo', domingoISO) : undefined;
    return this.http.get<{ colaboradorId: number; horasPendientes: number }>(
      `${this.base}/backlog/${colaboradorId}`, { params }
    );
  }

  getIncidencias(domingoISO?: string): Observable<IncidenciaY2[]> {
    const baseInc = `${environment.apiUrl}/v1/incidencias-y2`;
    return this.http.get<IncidenciaY2[]>(`${baseInc}/${domingoISO}`);
  }

  getResumenColaboradores(domingo?: string): Observable<any[]> {
    let params = new HttpParams();
    if (domingo) params = params.set('domingo', domingo);
    return this.http.get<any[]>(`${this.base}/resumen-colaboradores`, { params });
  }

  // NUEVO: generación por modo (por partes)
  generarPorModo(modo: Y2GenModo, domingoBase?: string): Observable<void> {
    let params = new HttpParams();
    if (domingoBase) params = params.set('domingoBase', domingoBase);
    return this.http.post<void>(`${this.base}/generar/${modo}`, null, { params });
  }

  setRotacionSeed(payload: { colaboradorId: number; ultimoDia: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY'; forzar?: boolean }): Observable<void> {
    return this.http.patch<void>(`${this.base}/rotacion/seed`, payload);
  }

}
