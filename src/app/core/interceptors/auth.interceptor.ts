import { HttpInterceptorFn, HttpErrorResponse, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';


export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  // 👇 log temprano para ver que el interceptor corre SIEMPRE
  console.log('🛰️ Interceptor ->', req.method, req.url);

  // Solo agregar Bearer a llamadas hacia nuestra API
  const isApi =
    req.url.startsWith(environment.apiUrl) ||      // absoluto a 8081
    req.url.startsWith('/api') ||                  // relativo (proxy)
    req.url.includes('://localhost:8081/api');     // por si acaso
  const access = auth.accessToken;


  let request = req;
  if (isApi && access) {
    request = req.clone({ setHeaders: { [environment.security.tokenHeader]: `${environment.security.tokenPrefix}${access}` } });
    console.log('➡️ Añadiendo header:', request.headers.get('Authorization'));
    console.log('🌐 Request URL:', req.url, '¿isApi?', isApi, 'token?', !!access);

  }


  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (isApi && err.status === 401) {
        // Intentar refrescar una vez
        return auth.refresh().pipe(
          switchMap((newAccess) => {
            const retried = req.clone({ setHeaders: { [environment.security.tokenHeader]: `${environment.security.tokenPrefix}${newAccess}` } });
            return next(retried);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
