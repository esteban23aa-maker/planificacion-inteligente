export interface HistorialCambio {
  id: number;
  fechaHora: string;            // formato ISO: '2025-07-06T10:15:00'
  tipoCambio: string;           // Ej: 'ASIGNACION', 'DESCANSO_Y1', etc.
  descripcion: string;
  realizadoPor: string;
  colaboradorId?: number;
  colaboradorNombre?: string;   // Opcional para visualización
}
