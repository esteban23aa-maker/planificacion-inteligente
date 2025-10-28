export interface CandidatoY2DTO {
  id: number;
  nombre: string;
  puestoBase?: string | null;
  grupo: 'TITULAR' | 'Y1' | 'Y2';
  compatible: boolean;
  asignacionesEseDia: number;
  colisionTurnoDistinto: boolean;
  colisionMismaFranja: boolean;
  superaLimiteDia: boolean;
  tieneBacklog: boolean;
  puntaje: number;
  razones: string[];
}

export interface IncidenciaY2DTO {
  id: number;
  domingoBase: string;         // ISO (YYYY-MM-DD)
  fecha: string;               // ISO
  colaboradorId: number;
  colaboradorNombre: string;
  grupo: 'TITULAR' | 'Y1' | 'Y2';
  turno?: string | null;       // 06:00-14:00 | 14:00-22:00 | null
  franja?: string | null;      // F_M1 | F_M2 | F_T1 | F_T2 | DIA_COMPLETO | null
  motivo: string;
  candidatos?: CandidatoY2DTO[];
}

export interface AplicarIncidenciaRequest {
  incidenciaId: number;
  reemplazoId: number;
  horas?: number;              // 4 u 8
  modalidad?: 'FRACCIONADO' | 'COMPLETO' | 'AUTO_Y2' | 'MOD_EXTRA';
  turno?: string | null;
  franja?: string | null;
}

export interface AplicacionResultDTO {
  incidenciaId: number;
  aplicado: boolean;
  descansoY2Id?: number | null;
  mensaje: string;
}
