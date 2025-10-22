import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const required: string[] = route.data?.['roles'] ?? [];

  // Logs de depuración
  console.log('🔑 Verificando acceso con roleGuard...');
  console.log('👉 Roles requeridos:', required);
  console.log('👉 Roles usuario:', auth.roles);

  // No autenticado → al login
  if (!auth.isAuthenticated()) {
    console.log('❌ No autenticado → login');
    return router.createUrlTree(['/login']);
  }

  // Si es ADMIN → acceso total (si quieres el bypass)
  if (auth.hasRole('ADMIN')) {
    console.log('✅ ADMIN detectado → acceso total');
    return true;
  }

  // Verificar roles requeridos
  if (required.length === 0 || auth.hasRole(...required)) {
    console.log('✅ Autorizado con roles');
    return true;
  }

  // Sin permisos → dashboard
  console.log('⚠️ No autorizado → dashboard');
  return router.createUrlTree(['/dashboard']);
};
