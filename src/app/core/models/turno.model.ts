import { Colaborador } from './colaborador.model';

export interface Turno {
  dia?: string;                 // Uso interno para display
  turno?: string;              // Muestra del nombre del turno (horario)
  maquina?: string;            // Info visual, no enviado al backend
  puesto?: string;             // Info visual, no enviado al backend
  colaborador: Colaborador;    // Relación completa para mostrar

  // Nuevos campos requeridos por el backend:
  id?: number;
  fecha: string;               // formato ISO: 'YYYY-MM-DD'
  horario: string;             // ejemplo: '06:00–14:00'
  colaboradorId: number | null;       // obligatorio para persistir
  activo: boolean;
}
