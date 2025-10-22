import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Puesto } from '../models/puesto.model';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class PuestosService {
  private api = environment.apiUrl + '/puestos';

  constructor(private http: HttpClient) { }

  getAll(): Observable<Puesto[]> {
    return this.http.get<Puesto[]>(this.api);
  }

  save(puesto: Puesto): Observable<any> {
    return this.http.post(this.api, puesto);
  }

  update(id: number, puesto: Puesto): Observable<any> {
    return this.http.put(`${this.api}/${id}`, puesto);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.api}/${id}`);
  }
}
