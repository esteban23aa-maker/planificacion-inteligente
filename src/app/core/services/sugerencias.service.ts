import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SugerenciaIA } from '../models/sugerencia.model';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class SugerenciasService {
  private apiUrl = `${environment.apiUrl}/ia/sugerencias`;

  constructor(private http: HttpClient) { }

  getAll(): Observable<SugerenciaIA[]> {
    return this.http.get<SugerenciaIA[]>(this.apiUrl);
  }

  aceptar(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/aceptar`, {});
  }

  rechazar(id: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/rechazar`, {});
  }
}
