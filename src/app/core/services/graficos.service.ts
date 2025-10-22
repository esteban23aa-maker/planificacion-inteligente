import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GraficosService {
  getTurnosDistribucion(): Observable<any[]> {
    return of([
      { name: '6:00 - 14:00', value: 120 },
      { name: '14:00 - 22:00', value: 90 },
      { name: '22:00 - 6:00', value: 60 }
    ]);
  }

  getCargaDiaria(): Observable<any[]> {
    return of([
      { name: 'Lunes', value: 50 },
      { name: 'Martes', value: 52 },
      { name: 'Miércoles', value: 48 },
      { name: 'Jueves', value: 54 },
      { name: 'Viernes', value: 49 },
      { name: 'Sábado', value: 45 }
    ]);
  }

  getSugerenciasIA(): Observable<any[]> {
    return of([
      { name: 'Reemplazo', value: 10 },
      { name: 'Turno', value: 5 },
      { name: 'Y1', value: 3 },
      { name: 'Y2', value: 7 }
    ]);
  }

  getReemplazosPorMaquina(): Observable<any[]> {
    return of([
      { name: 'P20', value: 4 },
      { name: 'P27A', value: 6 },
      { name: 'P28', value: 3 },
      { name: 'Secadero 3', value: 5 }
    ]);
  }
}