export interface Asignacion {
  id: number;
  fecha: string; // formato ISO
  turno: string;
  colaboradorId: number;
  colaboradorNombre: string;
  puestoId: number;
  puestoNombre: string;
  maquinaId: number;
  maquinaNombre: string;
  reemplazo: boolean;
  tieneTurnoFijo?: boolean;
}
