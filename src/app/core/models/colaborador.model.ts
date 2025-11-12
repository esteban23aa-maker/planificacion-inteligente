/*colaborador.model.ts*/
export interface Colaborador {
  id?: number;
  nombre: string;
  documento: string;
  grupo: string;

  rol?: string;            // Rol principal
  rolId?: number;

  maquinas: string[];
  puedeReemplazar: string[];  // Roles que puede reemplazar

  turno?: string;
  turnoId?: number;
  tieneTurnoFijo?: boolean;
  turnoFijo?: string; // Se enviará como texto al backend
  turnoFijoId?: number;

  maquina?: string;
  maquinaId?: number;

  puesto?: string;
  puestoId?: number;

  domingos?: string[];

  coordinadorId?: number;

  pendienteEliminacion?: boolean;
  fechaEliminacionProgramada?: string; // ISO (yyyy-MM-dd)
}
