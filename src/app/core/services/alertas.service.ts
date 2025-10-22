import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Alerta } from '../models/alerta.model';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class AlertasService {
  private apiUrl = `${environment.apiUrl}/alertas`;

  constructor(private http: HttpClient) { }

  getAll(): Observable<Alerta[]> {
    return this.http.get<Alerta[]>(this.apiUrl);
  }
}
