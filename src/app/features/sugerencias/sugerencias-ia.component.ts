import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SugerenciasService } from 'src/app/core/services/sugerencias.service';
import { SugerenciaIA } from 'src/app/core/models/sugerencia.model';

@Component({
  selector: 'app-sugerencias-ia',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sugerencias-ia.component.html',
  styleUrls: ['./sugerencias-ia.component.css']
})
export class SugerenciasIAComponent {
  private sugerenciasService = inject(SugerenciasService);
  sugerencias: SugerenciaIA[] = [];

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.sugerenciasService.getAll().subscribe((data: SugerenciaIA[]) => {
      this.sugerencias = data;
    });
  }

  aceptar(id: number): void {
    this.sugerenciasService.aceptar(id).subscribe(() => this.cargar());
  }

  rechazar(id: number): void {
    this.sugerenciasService.rechazar(id).subscribe(() => this.cargar());
  }
}
