import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Maquina } from '../models/maquina.model';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class MaquinasService {
  private api = `${environment.apiUrl}/maquinas`;

  constructor(private http: HttpClient) { }

  getAll(): Observable<Maquina[]> {
    return this.http.get<Maquina[]>(this.api);
  }

  save(maquina: Maquina): Observable<any> {
    return this.http.post(this.api, maquina);
  }

  update(id: number, maquina: Maquina): Observable<any> {
    return this.http.put(`${this.api}/${id}`, maquina);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.api}/${id}`);
  }
}
