// --- src/app/core/services/descansos-y2-crud.service.ts ---
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  private base = '/api/v1/descanso-y2/crud';

  getBacklog(domingo?: string | null) {
    const params: any = { light: true };
    if (domingo) params.domingo = domingo;
    return this.http.get<Y2BacklogItemDTO[]>(`${this.base}/backlog`, { params });
  }

  crear(req: Y2CreateRequest): Observable<DescansoY2DTO> {
    return this.http.post<DescansoY2DTO>(`${this.base}/crear`, req);
  }

  actualizar(req: Y2UpdateRequest): Observable<DescansoY2DTO> {
    return this.http.put<DescansoY2DTO>(`${this.base}/actualizar`, req);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  swap(req: Y2SwapRequest): Observable<DescansoY2DTO[]> {
    return this.http.post<DescansoY2DTO[]>(`${this.base}/swap`, req);
  }

  otorgarHoras(req: Y2OtorgarHorasRequest) {
    return this.http.post(`${this.base}/otorgar-horas`, req);
  }

  getDisponibles(params: { colaboradorId: number; fecha: string; horas: number; franja?: string | null }) {
    const p: any = { colaboradorId: params.colaboradorId, fecha: params.fecha, horas: params.horas };
    if (params.franja) p.franja = params.franja;
    return this.http.get<Y2DisponibilidadDTO[]>(`${this.base}/disponibles`, { params: p });
  }

  getSugerencia(params: { colaboradorId: number; fecha: string; horas?: number | null; franja?: string | null }) {
    const p: any = { colaboradorId: params.colaboradorId, fecha: params.fecha };
    if (params.horas != null) p.horas = params.horas;
    if (params.franja) p.franja = params.franja;
    return this.http.get<{ turno: string; franjaSugerida: string }>(`${this.base}/sugerencia`, { params: p });
  }

  resetDerechos(domingo: string) {
    const params: any = {};
    if (domingo) params.domingo = domingo; // 👈 el backend espera ?domingo=YYYY-MM-DD
    return this.http.post<{ domingoBase: string | null; colaboradoresAfectados: number; status: string }>(
      `${this.base}/reset-derechos`,
      {},                                  // body vacío
      { params }                           // 👈 query param
    );
  }

}
