// --- src/app/core/services/descansos-y2-crud.service.ts ---
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

import {
  Y2BacklogItemDTO,
  Y2CreateRequest,
  Y2UpdateRequest,
  Y2SwapRequest,
  Y2OtorgarHorasRequest,
  Y2DisponibilidadDTO,
  DescansoY2DTO
} from '../models/descanso-y2-crud.model';

@Injectable({ providedIn: 'root' })
export class DescansosY2CrudService {

  private http = inject(HttpClient);

  /**
   * Base URL REAL del backend (Railway)
   * Ejemplo final:
   * https://turnos-service-production.up.railway.app/api/v1/descanso-y2/crud
   */
  private readonly base = `${environment.apiUrl}/v1/descanso-y2/crud`;

  /** Backlog Y2 */
  getBacklog(domingo?: string | null): Observable<Y2BacklogItemDTO[]> {
    const params: any = { light: true };
    if (domingo) params.domingo = domingo;

    return this.http.get<Y2BacklogItemDTO[]>(
      `${this.base}/backlog`,
      { params }
    );
  }

  /** Crear descanso Y2 */
  crear(req: Y2CreateRequest): Observable<DescansoY2DTO> {
    return this.http.post<DescansoY2DTO>(
      `${this.base}/crear`,
      req
    );
  }

  /** Actualizar descanso Y2 */
  actualizar(req: Y2UpdateRequest): Observable<DescansoY2DTO> {
    return this.http.put<DescansoY2DTO>(
      `${this.base}/actualizar`,
      req
    );
  }

  /** Eliminar descanso Y2 */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${id}`
    );
  }

  /** Swap de descansos Y2 */
  swap(req: Y2SwapRequest): Observable<DescansoY2DTO[]> {
    return this.http.post<DescansoY2DTO[]>(
      `${this.base}/swap`,
      req
    );
  }

  /** Otorgar horas manualmente */
  otorgarHoras(req: Y2OtorgarHorasRequest): Observable<any> {
    return this.http.post(
      `${this.base}/otorgar-horas`,
      req
    );
  }

  /** Disponibilidad de reemplazos */
  getDisponibles(params: {
    colaboradorId: number;
    fecha: string;
    horas: number;
    franja?: string | null;
  }): Observable<Y2DisponibilidadDTO[]> {

    const p: any = {
      colaboradorId: params.colaboradorId,
      fecha: params.fecha,
      horas: params.horas
    };

    if (params.franja) p.franja = params.franja;

    return this.http.get<Y2DisponibilidadDTO[]>(
      `${this.base}/disponibles`,
      { params: p }
    );
  }

  /** Sugerencia automática */
  getSugerencia(params: {
    colaboradorId: number;
    fecha: string;
    horas?: number | null;
    franja?: string | null;
  }): Observable<{ turno: string; franjaSugerida: string }> {

    const p: any = {
      colaboradorId: params.colaboradorId,
      fecha: params.fecha
    };

    if (params.horas != null) p.horas = params.horas;
    if (params.franja) p.franja = params.franja;

    return this.http.get<{ turno: string; franjaSugerida: string }>(
      `${this.base}/sugerencia`,
      { params: p }
    );
  }

  /** Reset de derechos Y2 */
  resetDerechos(domingo: string): Observable<{
    domingoBase: string | null;
    colaboradoresAfectados: number;
    status: string;
  }> {

    const params: any = {};
    if (domingo) params.domingo = domingo; // ?domingo=YYYY-MM-DD

    return this.http.post<{
      domingoBase: string | null;
      colaboradoresAfectados: number;
      status: string;
    }>(
      `${this.base}/reset-derechos`,
      {},        // body vacío
      { params } // query param
    );
  }

}
