import { Colaborador } from './colaborador.model';

export interface SugerenciaIA {
  id: number;
  tipo: string;
  colaborador: Colaborador | null;
  razon: string;
  sugerencia: string;
  aceptada: boolean;
  criticidad: string;
}
