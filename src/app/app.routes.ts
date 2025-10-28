import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { AppShellComponent } from './ui/app-shell/app-shell.component';

export const routes: Routes = [
  // Login queda afuera del shell
  { path: 'login', loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent) },

  // Todo lo demás va dentro del Shell
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },

      { path: 'programacion', loadComponent: () => import('./features/programacion/programacion-semanal.component').then(m => m.ProgramacionSemanalComponent) },

      { path: 'domingo', loadComponent: () => import('./features/programacion/domingo.component').then(m => m.default) },

      { path: 'domingo/editar', loadComponent: () => import('./features/programacion/domingo-edicion.component').then(m => m.DomingoEdicionComponent), canActivate: [roleGuard], data: { roles: ['SUPERVISOR', 'ADMIN'] } },

      { path: 'descansos-y1', loadComponent: () => import('./features/descansos/descansos-y1.component').then(m => m.DescansosY1Component) },

      { path: 'descansos-y1/edicion', loadComponent: () => import('./features/descansos/descansos-y1-edicion.component').then(m => m.DescansosY1EdicionComponent), canActivate: [roleGuard], data: { roles: ['SUPERVISOR', 'ADMIN'] } },

      { path: 'descansos-y2', loadComponent: () => import('./features/descansos/descansos-y2.component').then(m => m.DescansosY2Component) },

      { path: 'admin/incidencias-y2', loadComponent: () => import('./features/y2-admin/incidencias-y2-admin.page').then(m => m.IncidenciasY2AdminPage) },

      { path: 'sugerencias', loadComponent: () => import('./features/sugerencias/sugerencias-ia.component').then(m => m.SugerenciasIAComponent), canActivate: [roleGuard], data: { roles: ['SUPERVISOR', 'ADMIN'] } },

      { path: 'historial', loadComponent: () => import('./features/historial/historial.component').then(m => m.HistorialComponent), canActivate: [roleGuard], data: { roles: ['SUPERVISOR', 'ADMIN'] } },

      { path: 'colaboradores', loadComponent: () => import('./features/crud/colaboradores.component').then(m => m.ColaboradoresComponent), canActivate: [roleGuard], data: { roles: ['SUPERVISOR', 'ADMIN'] } },

      { path: 'carga-inicial', loadComponent: () => import('./features/carga-inicial/carga-inicial.component').then(m => m.CargaInicialComponent), canActivate: [roleGuard], data: { roles: ['SUPERVISOR', 'ADMIN'] } },

      { path: 'crear-colaborador', loadComponent: () => import('./features/carga-inicial/formularios/crear-colaborador.component').then(m => m.CrearColaboradorComponent), canActivate: [roleGuard], data: { roles: ['SUPERVISOR', 'ADMIN'] } },

      { path: 'crear-puesto', loadComponent: () => import('./features/carga-inicial/formularios/crear-puesto.component').then(m => m.CrearPuestoComponent), canActivate: [roleGuard], data: { roles: ['SUPERVISOR', 'ADMIN'] } },

      { path: 'crear-maquina', loadComponent: () => import('./features/carga-inicial/formularios/crear-maquina.component').then(m => m.CrearMaquinaComponent), canActivate: [roleGuard], data: { roles: ['SUPERVISOR', 'ADMIN'] } },

      { path: 'crear-turno', loadComponent: () => import('./features/carga-inicial/formularios/crear-turno.component').then(m => m.CrearTurnoComponent), canActivate: [roleGuard], data: { roles: ['ADMIN'] } },

      { path: 'Alertas', loadComponent: () => import('./features/alertas/alertas.component').then(m => m.AlertasComponent), canActivate: [roleGuard], data: { roles: ['ADMIN'] } },

      { path: 'crear-rol', loadComponent: () => import('./features/carga-inicial/formularios/crear-rol.component').then(m => m.CrearRolComponent), canActivate: [roleGuard], data: { roles: ['SUPERVISOR', 'ADMIN'] } },

      {
        path: 'admin/usuarios',
        loadComponent: () => import('./features/admin/usuarios.component').then(m => m.UsuariosComponent),
        canActivate: [roleGuard],
        data: { roles: ['ADMIN'] }
      },

      { path: '**', redirectTo: 'dashboard' }
    ]
  }
];
