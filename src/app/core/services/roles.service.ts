import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Rol } from '../models/rol.model';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class RolesService {
  private api = `${environment.apiUrl}/roles-produccion`;  // actualizado

  constructor(private http: HttpClient) { }

  getAll(): Observable<Rol[]> {
    return this.http.get<Rol[]>(this.api);
  }

  save(rol: Rol): Observable<any> {
    return this.http.post(this.api, rol);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.api}/${id}`);
  }

  sincronizarDesdePuestos(): Observable<any> {
    return this.http.post(`${this.api}/sincronizar-desde-puestos`, {});
  }
}
