// src/app/core/models/programacion-semanal.model.ts
export interface ProgramacionSemanal {
  colaboradorId: number;
  colaboradorNombre: string;
  puesto: string;
  maquina: string;
  grupo: string;
  turno: string;
  coordinadorId?: number;
}
