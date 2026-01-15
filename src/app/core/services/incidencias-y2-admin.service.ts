import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from 'src/environments/environment';

import {
  AplicarIncidenciaRequest,
  AplicacionResultDTO,
  IncidenciaY2DTO,
  CandidatoY2DTO
} from '../models/incidencias-y2.models';

/* =======================
   DTOs (sin cambios)
======================= */

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
  disponible?: boolean;
  bloqueos?: string[];
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

/* =======================
   SERVICE
======================= */

@Injectable({ providedIn: 'root' })
export class IncidenciasY2AdminService {

  /**
   * Base real del backend (Railway)
   * Ejemplo:
   * https://turnos-service-production.up.railway.app/api/v1/admin/incidencias-y2
   */
  private readonly base = `${environment.apiUrl}/v1/admin/incidencias-y2`;

  private sse$ = new Subject<any>();
  sseEvents$ = this.sse$.asObservable();

  constructor(
    private http: HttpClient,
    private zone: NgZone
  ) { }

  /* ===== Incidencias ===== */

  getSemana(domingoBase: string, incluirCandidatos = false) {
    return this.http.get<IncidenciaY2DTO[]>(
      `${this.base}?domingoBase=${domingoBase}&incluirCandidatos=${incluirCandidatos}`
    );
  }

  candidatos(incidenciaId: number): Observable<CandidatoY2DTO[]> {
    return this.http.get<CandidatoY2DTO[]>(
      `${this.base}/${incidenciaId}/candidatos`
    );
  }

  // Alias legacy
  getCandidatos(incidenciaId: number): Observable<CandidatoY2DTO[]> {
    return this.candidatos(incidenciaId);
  }

  aplicarUno(body: AplicarIncidenciaRequest) {
    return this.http.post<AplicacionResultDTO>(
      `${this.base}/aplicar`,
      body
    );
  }

  aplicarLote(items: AplicarIncidenciaRequest[]) {
    return this.http.post<AplicacionResultDTO[]>(
      `${this.base}/aplicar-lote`,
      { items }
    );
  }

  /* ===== Agenda semanal ===== */

  getAgenda(domingoBase: string) {
    return this.http.get<AgendaSemanaDTO>(
      `${this.base}/agenda?domingoBase=${domingoBase}`
    );
  }

  getAgendaLibre(domingoBase: string, titularId: number, incluirY1 = true) {
    return this.http.get<AgendaSemanaDTO>(
      `${this.base}/agenda-libre?domingoBase=${domingoBase}&titularId=${titularId}&incluirY1=${incluirY1}`
    );
  }

  /* ===== Holds ===== */

  crearHold(req: CrearHoldRequest) {
    return this.http.post<HoldDTO>(
      `${this.base}/holds`,
      req
    );
  }

  liberarHold(id: number) {
    return this.http.delete<void>(
      `${this.base}/holds/${id}`
    );
  }

  /* ===== Aplicación directa ===== */

  aplicarDirecto(body: AplicarDirectoRequest) {
    return this.http.post<AplicacionResultDTO>(
      `${this.base}/aplicar-directo`,
      body
    );
  }

  /* ===== SSE (NO pasa por interceptor) ===== */

  connectSSE(): EventSource {
    const src = new EventSource(`${this.base}/events`);

    src.onmessage = (ev) => {
      this.zone.run(() =>
        this.sse$.next({ type: 'message', data: ev.data })
      );
    };

    src.addEventListener('y2.applied', (ev: any) => {
      try {
        const data = JSON.parse(ev.data);
        this.zone.run(() =>
          this.sse$.next({ type: 'y2.applied', data })
        );
      } catch { }
    });

    src.addEventListener('connected', () => {
      this.zone.run(() =>
        this.sse$.next({ type: 'connected' })
      );
    });

    src.onerror = () => {
      // El navegador reintenta automáticamente
    };

    return src;
  }
}
