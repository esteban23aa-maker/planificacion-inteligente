import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { HistorialCambio } from '../models/historial.model';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class HistorialService {
  private apiUrl = `${environment.apiUrl}/historial`;

  constructor(private http: HttpClient) { }

  obtenerTodos(): Observable<HistorialCambio[]> {
    return this.http.get<HistorialCambio[]>(this.apiUrl);
  }

  obtenerUltimosCambios(): Observable<HistorialCambio[]> {
    return this.http.get<HistorialCambio[]>(`${this.apiUrl}/ultimos`);
  }

  registrarCambio(cambio: HistorialCambio): Observable<void> {
    return this.http.post<void>(this.apiUrl, cambio);
  }

  eliminarCambio(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
