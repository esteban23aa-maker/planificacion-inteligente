// src/app/core/models/descanso-y2.model.ts
export interface DescansoY2 {
  id: number;
  domingoBase: string;     // ISO YYYY-MM-DD
  fechaReduccion: string;  // ISO YYYY-MM-DD (L..S)
  horas: number;           // 1..8
  modalidad: 'FRACCIONADO' | 'COMPLETO' | 'AUTO_Y2';
  estado: 'ASIGNADO' | 'MANUAL';
  acumuladasPrevias: boolean;

  colaborador: string;     // titular
  reemplazo: string;       // Y2 (o titular si AUTO_Y2)
  puesto: string;
  maquina: string;
  turno: string;
  franja?: string;
}

export interface ReemplazoY2 {
  reemplazo: string;
  puedeReemplazar: string[];
}

export interface IncidenciaY2 {
  id: number;
  domingoBase: string;   // ISO
  fecha: string;         // ISO
  colaboradorId: number;
  colaboradorNombre: string;
  grupo: string;
  turno?: string;
  franja?: string;
  motivo: string;
}
