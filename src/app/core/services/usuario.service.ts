import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Usuario } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/usuarios';

  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.baseUrl);
  }

  crear(username: string, password: string, rol: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/crear`, { username, password, rol });
  }

  cambiarPassword(username: string, nuevaPassword: string): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/cambiar-password`, { username, nuevaPassword });
  }

  desactivar(id: number): Observable<void> {
    return this.http.put<void>(`${this.baseUrl}/${id}/desactivar`, {});
  }
}
