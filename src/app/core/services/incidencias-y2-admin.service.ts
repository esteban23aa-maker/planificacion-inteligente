import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, map } from 'rxjs';
import { AplicarIncidenciaRequest, AplicacionResultDTO, IncidenciaY2DTO, CandidatoY2DTO } from '../models/incidencias-y2.models';

export interface AgendaSemanaDTO {
  domingoBase: string;
  items: AgendaSlotDTO[];
}
export interface AgendaSlotDTO {
  incidenciaId: number;
  titularId: number;
  titularNombre: string;
  fecha: string;
  turno: string;
  franja: string;
  puesto?: string;
  maquina?: string;
  candidatos: AgendaCandidatoDTO[];
}
export interface AgendaCandidatoDTO {
  id: number;
  nombre: string;
  grupo: 'Y1' | 'Y2';
  asignacionesEseDia: number;
  puestoBase?: string;
  compatible: boolean;
  superaLimiteDia: boolean;
  colisionTurnoDistinto: boolean;
  colisionMismaFranja: boolean;
  tieneBacklog: boolean;
  holdActivo: boolean;
  puntaje: number;
  razones: string[];
  disponible?: boolean;     // viene del backend
  bloqueos?: string[];      // motivos por los que no está disponible
}

export interface CrearHoldRequest {
  incidenciaId: number;
  reemplazoId: number;
  fecha: string;
  turno: string;
  franja: string;
  ttlMin?: number;
  createdBy?: string;
}
export interface HoldDTO {
  id: number;
  incidenciaId: number;
  reemplazoId: number;
  fecha: string;
  turno: string;
  franja: string;
  expiresAtIso: string;
}
export interface AplicarDirectoRequest {
  titularId: number;
  reemplazoId: number;
  fecha: string;
  turno: string;
  franja: string;
  horas?: number;
  modalidad?: 'FRACCIONADO' | 'COMPLETO';
}

@Injectable({ providedIn: 'root' })
export class IncidenciasY2AdminService {
  private base = '/api/v1/admin/incidencias-y2';

  private sse$ = new Subject<any>();
  sseEvents$ = this.sse$.asObservable();

  constructor(private http: HttpClient, private zone: NgZone) { }

  getSemana(domingoBase: string, incluirCandidatos = false) {
    return this.http.get<IncidenciaY2DTO[]>(`${this.base}?domingoBase=${domingoBase}&incluirCandidatos=${incluirCandidatos}`);
  }

  candidatos(incidenciaId: number): Observable<CandidatoY2DTO[]> {
    return this.http.get<CandidatoY2DTO[]>(
      `${this.base}/${incidenciaId}/candidatos`
    );
  }

  // Alias por compatibilidad con componentes antiguos
  getCandidatos(incidenciaId: number): Observable<CandidatoY2DTO[]> {
    return this.candidatos(incidenciaId);
  }

  aplicarUno(body: AplicarIncidenciaRequest) {
    return this.http.post<AplicacionResultDTO>(`${this.base}/aplicar`, body);
  }

  aplicarLote(items: AplicarIncidenciaRequest[]) {
    return this.http.post<AplicacionResultDTO[]>(`${this.base}/aplicar-lote`, { items });
  }

  // ===== Agenda semanal
  getAgenda(domingoBase: string) {
    return this.http.get<AgendaSemanaDTO>(`${this.base}/agenda?domingoBase=${domingoBase}`);
  }

  crearHold(req: CrearHoldRequest) {
    return this.http.post<HoldDTO>(`${this.base}/holds`, req);
  }

  liberarHold(id: number) {
    return this.http.delete<void>(`${this.base}/holds/${id}`);
  }

  // ===== SSE
  connectSSE() {
    const src = new EventSource(`${this.base}/events`);
    src.onmessage = (ev) => {
      this.zone.run(() => this.sse$.next({ type: 'message', data: ev.data }));
    };
    src.addEventListener('y2.applied', (ev: any) => {
      try {
        const data = JSON.parse(ev.data);
        this.zone.run(() => this.sse$.next({ type: 'y2.applied', data }));
      } catch { }
    });
    src.addEventListener('connected', () => {
      this.zone.run(() => this.sse$.next({ type: 'connected' }));
    });
    src.onerror = () => {
      // el navegador reintenta solo
    };
    return src;
  }

  getAgendaLibre(domingoBase: string, titularId: number, incluirY1 = true) {
    return this.http.get<AgendaSemanaDTO>(
      `${this.base}/agenda-libre?domingoBase=${domingoBase}&titularId=${titularId}&incluirY1=${incluirY1}`
    );
  }

  aplicarDirecto(body: AplicarDirectoRequest) {
    return this.http.post<AplicacionResultDTO>(`${this.base}/aplicar-directo`, body);
  }
}
