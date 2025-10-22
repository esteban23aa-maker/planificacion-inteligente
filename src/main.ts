import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { LOCALE_ID } from '@angular/core';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';

// 👇 IMPORTA y REGISTRA el locale ES
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
registerLocaleData(localeEs); // <= ¡línea clave!

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes),
    provideAnimations(),
    { provide: LOCALE_ID, useValue: 'es' }
  ]
}).catch(err => console.error(err));

