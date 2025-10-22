export interface ColaboradorDomingoDTO {
  id: number;
  nombre: string;
  turno: string;
  maquinaId?: number | null;
  puestoId?: number | null;
  maquina?: string; // opcional, solo para mostrar
  puesto?: string;  // opcional, solo para mostrar
  tipoAsignacion: string;
}

export interface DomingoConColaboradoresDTO {
  id: number;
  fecha: string; // ISO Date string
  trabajado: boolean;
  colaboradores: ColaboradorDomingoDTO[];

}

export interface AsignacionDomingoDTO {
  colaboradorId: number;
  turno: string;
  tipoAsignacion: string;
}

