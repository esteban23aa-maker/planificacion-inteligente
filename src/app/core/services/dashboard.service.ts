/** C:\Proyectos\planificacion-inteligente\src\app\core\services\dashboard.service.ts */

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, shareReplay, throwError } from 'rxjs';

import { environment } from 'src/environments/environment';
import { DashboardRootDTO } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private apiUrl = `${environment.apiUrl}/v1/dashboard`;;

  // cache simple por base
  private cache = new Map<string, Observable<DashboardRootDTO>>();

  constructor(private http: HttpClient) {}

  /**
   * GET /api/v1/dashboard?domingoBase=YYYY-MM-DD
   * Si no envías base, el backend calcula el domingo actual.
   */
  obtenerDashboard(domingoBase?: string): Observable<DashboardRootDTO> {
    const key = domingoBase ?? 'AUTO';

    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    let params = new HttpParams();
    if (domingoBase) {
      params = params.set('domingoBase', domingoBase);
    }

    const req$ = this.http.get<DashboardRootDTO>(this.apiUrl, { params }).pipe(
      shareReplay(1),
      catchError((err) => {
        // limpia cache si falla, para que reintente después
        this.cache.delete(key);
        return throwError(() => err);
      })
    );

    this.cache.set(key, req$);
    return req$;
  }

  /** Por si quieres refrescar manualmente */
  limpiarCache(): void {
    this.cache.clear();
  }
}
