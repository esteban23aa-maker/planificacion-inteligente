/* C:\Proyectos\planificacion-inteligente\src\app\core\models\dashboard.model.ts */

export interface DashboardRootDTO {
  health: DashboardHealthDTO;
  operacion: DashboardOperacionDTO;
  tendencias: DashboardTendenciasDTO;
  acciones: DashboardAccionesDTO;
}

// =======================
// CAPA 1: HEALTH
// =======================
export interface DashboardHealthDTO {
  colaboradoresActivos: number;
  colaboradoresInactivos: number;
  maquinasActivas: number;
  maquinasSinAsignacion: number;
  turnosSemana: number;
  porcentajeDiasCubiertos: number;
  alertasActivas: number;
  incidenciasAbiertas: number;
}

// =======================
// CAPA 2: OPERACIÓN
// =======================
export interface DashboardOperacionDTO {
  y1: Y1ResumenDTO;
  y2: Y2ResumenDTO;
}

export interface Y1ResumenDTO {
  totalSemana: number;
  automaticos: number;
  manuales: number;
  sinAsignar: number;
  reemplazosEfectivos: number;
  reemplazosFallidos: number;
}

export interface Y2ResumenDTO {
  totalGenerados: number;
  porFranja: Record<string, number>;
  backlogTotalHoras: number;
  colaboradoresBacklogCritico: number;
  sinAsignar: number;
  diferidosNoche: number;
}

export interface FranjaCountDTO {
  franja: string;
  cantidad: number;
}

// =======================
// CAPA 3: TENDENCIAS
// =======================
export interface DashboardTendenciasDTO {
  turnos: SerieSemanalDTO[];
  y1: SerieSemanalDTO[];
  y2: SerieSemanalDTO[];
  backlogY2: SerieSemanalDTO[];
}

export interface SerieSemanalDTO {
  semana: string; // LocalDate ISO "yyyy-MM-dd"
  valor: number;
}

// =======================
// CAPA 4: ACCIONES
// =======================
export interface DashboardAccionesDTO {
  backlogCritico: ColaboradorRiesgoDTO[];
  diasSinAsignar: DiaCriticoDTO[];
  alertasPendientes: AlertaResumenDTO[];
}

export interface ColaboradorRiesgoDTO {
  colaboradorId: number;
  nombre: string;
  backlogHoras: number;
}

export interface DiaCriticoDTO {
  fecha: string; // LocalDate ISO
  cantidad: number;
}

export interface AlertaResumenDTO {
  id: number;
  tipo: string;
  mensaje: string;
  diasAbierta: number;
}
