import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertasService } from 'src/app/core/services/alertas.service';
import { Alerta } from 'src/app/core/models/alerta.model';

@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alertas.component.html',
  styleUrls: ['./alertas.component.css']
})
export class AlertasComponent {
  private alertasService = inject(AlertasService);
  alertas: Alerta[] = [];

  constructor() {
    this.cargar();
  }

  cargar() {
    this.alertasService.getAll().subscribe(data => {
      this.alertas = data.filter(alerta => !alerta.resuelta); // ✅ Solo no resueltas
    });
  }

  getColor(nivel: string): string {
    switch (nivel?.toLowerCase()) {
      case 'alta': return 'red';
      case 'media': return 'orange';
      case 'baja': return 'green';
      default: return 'gray';
    }
  }
}

// 👇 Esta exportación es necesaria para el lazy loading (loadComponent)
export default AlertasComponent;
