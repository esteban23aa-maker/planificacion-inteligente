// src/app/core/models/descanso-y1.model.ts

export interface TrabajadorDomingo {
  nombre: string;
  puesto: string;
  maquina: string;
  turnoMiercoles: string;
}

export interface ReemplazoY1 {
  reemplazo: string;
  puestoY1: string;
  titular: string;
  puestoTitular: string;
}

export interface DescansoY1 {
  id: number;
  domingoBase: string;
  fechaDescanso: string;
  descansoDoble: boolean;
  estado: string;
  motivo: string;
  creadoPorSistema: boolean;   // ⚡ NUEVO (visibilidad UI)
  colaborador: string;
  reemplazo: string;
  puesto: string;
  maquina: string;
  turno: string;

  // ⚡ NUEVO: para poder operar (reset individual etc.)
  colaboradorId: number;
  reemplazoId?: number | null;
}

// ⚡ NUEVO
export type Severity = 'INFO' | 'WARNING' | 'ERROR';

export interface IncidenciaDTO {
  severity: Severity;      // INFO, WARNING, ERROR
  code: string;            // CRUD-001, CRUD-010...
  message: string;         // Texto legible
  context: Record<string, any>;  // Datos adicionales
  domingoBase: string;     // a qué semana pertenece
}
