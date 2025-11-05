// C:\Proyectos\planificacion-inteligente\src\app\core\models\descanso-y2-crud.model.ts
export interface Y2DisponibilidadDTO {
  colaboradorId: number;
  nombre: string;
  observacionCompatibilidad: string;
}

export interface Y2SlotDTO {
  fecha: string;     // ISO 'YYYY-MM-DD'
  turno: string;     // 'MAN' | 'TAR' | etc. (según tu backend)
  franja: string;    // '06:00-10:00' | '10:00-14:00' | '14:00-18:00' | '18:00-22:00' | 'DIA_COMPLETO'
  libre: boolean;
}

export interface Y2BacklogItemDTO {
  colaboradorId: number;
  nombre: string;
  grupo: string;
  backlogHorasHastaBase: number;
  diaPropioFecha: string;   // ISO
  diaPropio: string;        // DayOfWeek
  turnoSugerido: string;
  franjaSugerida: string;
  incidenciasSemana: string[];
  y2Disponibles: Y2DisponibilidadDTO[];
  slotsVaciosDia: Y2SlotDTO[];
}

// Requests al backend CRUD
export interface Y2CreateRequest {
  colaboradorId: number;
  fecha: string;
  horas: number;                // 4 u 8
  franja?: string | null;       // si 8h => 'DIA_COMPLETO'
  reemplazoId?: number | null;  // opcional
  acumuladasPrevias?: boolean;
  forzar?: boolean;
}

export interface Y2UpdateRequest {
  id: number;
  nuevaFecha?: string | null;
  horas?: number | null;
  franja?: string | null;
  reemplazoId?: number | null;
  forzar?: boolean;
}

export interface Y2SwapRequest {
  idA: number;
  idB: number;
  forzar?: boolean;
}

export interface Y2OtorgarHorasRequest {
  colaboradorId: number;
  domingoBase: string; // ISO domingo
  horas: number;
  diferirASiguiente?: boolean;
}
