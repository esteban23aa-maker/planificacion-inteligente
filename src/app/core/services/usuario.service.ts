import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Usuario } from '../models/usuario.model';

@Injectable({ providedIn: 'root' })
export class UsuarioService {

  private http = inject(HttpClient);

  /**
   * Base real del backend (Railway)
   * Resultado:
   * https://turnos-service-production.up.railway.app/api/usuarios
   */
  private readonly baseUrl = `${environment.apiUrl}/usuarios`;

  /** Listar usuarios */
  listar(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.baseUrl);
  }

  /** Crear usuario */
  crear(username: string, password: string, rol: string): Observable<void> {
    return this.http.post<void>(
      `${this.baseUrl}/crear`,
      { username, password, rol }
    );
  }

  /** Cambiar contraseña */
  cambiarPassword(username: string, nuevaPassword: string): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/cambiar-password`,
      { username, nuevaPassword }
    );
  }

  /** Desactivar usuario */
  desactivar(id: number): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/${id}/desactivar`,
      {}
    );
  }
}
