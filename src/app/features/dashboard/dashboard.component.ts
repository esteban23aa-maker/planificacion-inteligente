import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';

// Servicios y modelos
import { DashboardService } from 'src/app/core/services/dashboard.service';
import { Dashboard } from 'src/app/core/models/dashboard.model';
import { HistorialService } from 'src/app/core/services/historial.service';
import { HistorialCambio } from 'src/app/core/models/historial.model';

// UI y Charts
import {
  NgApexchartsModule,
  ApexChart, ApexLegend, ApexDataLabels, ApexStroke, ApexPlotOptions
} from 'ng-apexcharts';
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { MetricCardComponent } from 'src/app/ui/metric-card/metric-card.component';
import { DataTableComponent } from 'src/app/ui/data-table/data-table.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NgApexchartsModule,
    PageHeaderComponent,
    MetricCardComponent,
    DataTableComponent,
    MatIconModule
  ],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit, AfterViewInit {
  datos?: Dashboard;
  historialCambios: HistorialCambio[] = [];

  cargando = true;
  error?: string;

  // Series para gráficos
  descansosData: number[] = [0, 0];
  alertasData: number[] = [0, 0];

  // Paleta de marca (se setea en ngAfterViewInit para garantizar resolución de CSS vars)
  descansosColors: string[] = ['#0477BF', '#78BEE6']; // fallback inicial
  alertasColors: string[] = ['#0477BF', '#78BEE6']; // fallback inicial

  // Opciones tipadas para evitar TS2322
  donutChart: ApexChart = { type: 'donut', height: 300 };
  donutLegend: ApexLegend = { position: 'bottom' };
  donutDataLabels: ApexDataLabels = { enabled: true, formatter: (v: number) => `${v.toFixed(0)}%` };
  donutStroke: ApexStroke = { width: 2, colors: ['#fff'] };
  donutPlotOptions: ApexPlotOptions = { pie: { donut: { size: '72%' } } };

  constructor(
    private dashboardService: DashboardService,
    private historialService: HistorialService
  ) { }

  ngOnInit(): void {
    this.cargarDatos();
    this.cargarCambiosRecientes();
  }

  // ✅ Asegura que los colores se lean cuando el DOM ya tiene las CSS vars
  ngAfterViewInit(): void {
    const p600 = this.css('--brand-600', '#0477BF');
    const p300 = this.css('--brand-300', '#78BEE6');
    this.descansosColors = [p600, p300];
    this.alertasColors = [p600, p300];
  }

  get hasDescansosData() { return (this.descansosData?.reduce((a, b) => a + b, 0) ?? 0) > 0; }
  get hasAlertasData() { return (this.alertasData?.reduce((a, b) => a + b, 0) ?? 0) > 0; }

  cargarDatos(): void {
    this.cargando = true;
    this.dashboardService.obtenerResumen().subscribe({
      next: (data) => {
        this.datos = data;
        this.descansosData = [data.descansosY1Semana, data.descansosY2Semana];
        this.alertasData = [data.alertasActivas, data.sugerenciasPendientes];
        this.cargando = false;
      },
      error: () => {
        this.error = 'Error al cargar datos del dashboard';
        this.cargando = false;
      }
    });
  }

  get subtitle(): string {
    const hoy = new Date();
    return `Hoy es ${formatDate(hoy, "d 'de' MMMM 'de' y, h:mm a", 'es-CO')}`;
  }

  cargarCambiosRecientes(): void {
    this.historialService.obtenerUltimosCambios().subscribe({
      next: (res) => (this.historialCambios = res),
      error: () => (this.historialCambios = [])
    });
  }

  private css(varName: string, fallback: string): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v || fallback;
  }
}
