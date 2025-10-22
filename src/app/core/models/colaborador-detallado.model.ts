/**colaborador-detallado.model.ts */

import { Maquina } from './maquina.model';
import { Puesto } from './puesto.model';
import { Rol } from './rol.model';

export interface ColaboradorDetallado {
  id: number;
  nombre: string;
  documento: string;
  grupo: string;

  rol: Rol | null;
  puesto: Puesto | null;
  maquina: Maquina | null;

  maquinas: Maquina[];
  puedeReemplazar: Rol[];

  coordinadorId?: number;
  coordinadorNombre?: string;

  // ✅ Solo para frontend
  seleccionado?: boolean;

  tieneTurnoFijo?: boolean;

  // ✅ Estos dos campos son importantes para reflejar correctamente el backend
  turnoFijo?: string;       // ejemplo: "14-22"
  turnoFijoId?: number;     // ejemplo: 2
  turno?: string;
}

