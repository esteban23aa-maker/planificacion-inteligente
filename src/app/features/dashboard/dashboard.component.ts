/** C:\Proyectos\planificacion-inteligente\src\app\features\dashboard\dashboard.component.ts */

import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';

import { DashboardService } from 'src/app/core/services/dashboard.service';
import { DashboardRootDTO } from 'src/app/core/models/dashboard.model';

import {
  NgApexchartsModule,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexStroke,
  ApexLegend,
  ApexPlotOptions,
  ApexXAxis,
  ApexYAxis,
  ApexGrid,
  ApexTooltip
} from 'ng-apexcharts';

import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { MetricCardComponent } from 'src/app/ui/metric-card/metric-card.component';
import { DataTableComponent } from 'src/app/ui/data-table/data-table.component';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NgApexchartsModule,
    PageHeaderComponent,
    MetricCardComponent,
    DataTableComponent,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit {

  data?: DashboardRootDTO;

  cargando = true;
  error?: string;

  // semana seleccionada (domingoBase)
  domingoBase?: string; // "YYYY-MM-DD"

  // Paleta (se lee de CSS vars)
  brand600 = '#0477BF';
  brand300 = '#78BEE6';
  danger600 = '#EF4444';
  warning600 = '#F59E0B';
  success600 = '#16A34A';

  // =========================
  // Donuts
  // =========================
  donutChart: ApexChart = { type: 'donut', height: 300 };
  donutLegend: ApexLegend = { position: 'bottom' };
  donutDataLabels: ApexDataLabels = { enabled: true, formatter: (v: number) => `${v.toFixed(0)}%` };
  donutStroke: ApexStroke = { width: 2, colors: ['#fff'] };
  donutPlotOptions: ApexPlotOptions = { pie: { donut: { size: '72%' } } };

  // Series
  donutDescansosSeries: number[] = [0, 0];
  donutAlertasSeries: number[] = [0, 0];

  donutDescansosColors: string[] = [this.brand600, this.brand300];
  donutAlertasColors: string[] = [this.brand600, this.warning600];

  get hasDescansosData(): boolean {
    return (this.donutDescansosSeries?.reduce((a, b) => a + b, 0) ?? 0) > 0;
  }

  get hasAlertasData(): boolean {
    return (this.donutAlertasSeries?.reduce((a, b) => a + b, 0) ?? 0) > 0;
  }

  // =========================
  // Barras Y2 por franja
  // =========================
  y2FranjaChart: ApexChart = { type: 'bar', height: 320, toolbar: { show: false } };
  y2FranjaSeries: ApexAxisChartSeries = [{ name: 'Cantidad', data: [] }];
  y2FranjaXAxis: ApexXAxis = { categories: [] };
  y2FranjaYAxis: ApexYAxis = { decimalsInFloat: 0 };
  y2FranjaGrid: ApexGrid = { strokeDashArray: 4 };
  y2FranjaDataLabels: ApexDataLabels = { enabled: false };
  y2FranjaTooltip: ApexTooltip = { enabled: true };

  // =========================
  // Tendencias (líneas)
  // =========================
  trendsChart: ApexChart = { type: 'line', height: 320, toolbar: { show: false } };
  trendsStroke: ApexStroke = { curve: 'smooth', width: 3 };
  trendsDataLabels: ApexDataLabels = { enabled: false };
  trendsXAxis: ApexXAxis = { categories: [] };
  trendsYAxis: ApexYAxis = { decimalsInFloat: 0 };
  trendsGrid: ApexGrid = { strokeDashArray: 4 };
  trendsTooltip: ApexTooltip = { enabled: true };

  trendsSeries: ApexAxisChartSeries = [
    { name: 'Turnos', data: [] },
    { name: 'Y1', data: [] },
    { name: 'Y2', data: [] },
    { name: 'Backlog Y2', data: [] }
  ];

  constructor(private dash: DashboardService) { }

  ngOnInit(): void {
    this.cargar();
  }

  ngAfterViewInit(): void {
    // Lee CSS vars cuando el DOM ya está listo
    this.brand600 = this.css('--brand-600', this.brand600);
    this.brand300 = this.css('--brand-300', this.brand300);

    this.donutDescansosColors = [this.brand600, this.brand300];
    this.donutAlertasColors = [this.brand600, this.warning600];
  }

  // =========================
  // UI helpers
  // =========================
  get subtitle(): string {
    const hoy = new Date();
    return `Hoy es ${formatDate(hoy, "d 'de' MMMM 'de' y, h:mm a", 'es-CO')}`;
  }

  get semanaLabel(): string {
    if (!this.domingoBase) return 'Semana actual (AUTO)';
    return `Semana base: ${this.domingoBase}`;
  }

  // =========================
  // Cargar dashboard
  // =========================
  cargar(): void {
    this.cargando = true;
    this.error = undefined;

    this.dash.obtenerDashboard(this.domingoBase).subscribe({
      next: (res) => {
        this.data = res;
        this.mapearGraficas(res);
        this.cargando = false;
      },
      error: () => {
        this.error = 'Error al cargar datos del dashboard (verifica backend / CORS / token).';
        this.cargando = false;
      }
    });
  }

  refrescar(): void {
    this.dash.limpiarCache();
    this.cargar();
  }

  onSemanaChange(value: string): void {
    // input type="date" entrega YYYY-MM-DD
    this.domingoBase = value || undefined;
    this.refrescar();
  }

  // =========================
  // Mapeos a gráficas
  // =========================
  private mapearGraficas(res: DashboardRootDTO): void {

    // Donut descansos Y1 vs Y2
    const y1Total = res.operacion?.y1?.totalSemana ?? 0;
    const y2Total = res.operacion?.y2?.totalGenerados ?? 0;
    this.donutDescansosSeries = [y1Total, y2Total];

    // Donut alertas proxy: SIN_ASIGNAR + backlog alto (para visual)
    const y1SinAsignar = res.operacion?.y1?.sinAsignar ?? 0;
    const y2SinAsignar = res.operacion?.y2?.sinAsignar ?? 0;
    const alertas = y1SinAsignar + y2SinAsignar;
    const sugerencias = res.acciones?.alertasPendientes?.length ?? 0;
    this.donutAlertasSeries = [alertas, sugerencias];

    // Barras por franja Y2
    const porFranja = res.operacion?.y2?.porFranja ?? {};
    const order = ['M1', 'M2', 'T1', 'T2', 'DIA_COMPLETO', 'PARCIAL_2H']; // por si existe
    const categories: string[] = [];
    const values: number[] = [];

    // primero las conocidas
    for (const k of order) {
      if (porFranja[k] !== undefined) {
        categories.push(k);
        values.push(porFranja[k]);
      }
    }
    // luego cualquier otra franja rara
    for (const k of Object.keys(porFranja)) {
      if (!categories.includes(k)) {
        categories.push(k);
        values.push(porFranja[k]);
      }
    }

    this.y2FranjaXAxis = { categories };
    this.y2FranjaSeries = [{ name: 'Cantidad', data: values }];

    // Tendencias (últimas N semanas)
    const seriesTurnos = res.tendencias?.turnos ?? [];
    const seriesY1 = res.tendencias?.y1 ?? [];
    const seriesY2 = res.tendencias?.y2 ?? [];
    const seriesBacklog = res.tendencias?.backlogY2 ?? [];

    const labels = seriesTurnos.map(s => s.semana);
    this.trendsXAxis = { categories: labels };

    this.trendsSeries = [
      { name: 'Turnos', data: seriesTurnos.map(s => s.valor) },
      { name: 'Y1', data: seriesY1.map(s => s.valor) },
      { name: 'Y2', data: seriesY2.map(s => s.valor) },
      { name: 'Backlog Y2', data: seriesBacklog.map(s => s.valor) }
    ];
  }

  // =========================
  // Utils
  // =========================
  private css(varName: string, fallback: string): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v || fallback;
  }
}
