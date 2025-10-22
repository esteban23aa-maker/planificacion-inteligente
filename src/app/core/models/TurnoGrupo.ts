export interface TurnoGrupo {
  id?: number;
  grupo: string;               // Ej: 'Titular', 'Y1', 'Y2'
  horario: string;             // Ej: '06:00–14:00'
  fechaInicio?: string;        // Opcional: cuándo empieza a aplicar
  activo: boolean;
}
