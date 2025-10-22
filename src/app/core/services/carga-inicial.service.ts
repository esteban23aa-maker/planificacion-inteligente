import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { ColaboradorCargaInicial } from '../models/colaborador-carga-inicial.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CargaInicialService {
  private api = environment.apiUrl + '/carga-inicial';

  constructor(private http: HttpClient) { }

  inicializar() {
    return this.http.post(this.api, {}, { responseType: 'text' });
  }

  limpiarTodo() {
    return this.http.delete(this.api, { responseType: 'text' });
  }

  saveCargaInicial(lista: ColaboradorCargaInicial[]): Observable<any> {
    return this.http.post(`${this.api}/lista`, lista);
  }

}
