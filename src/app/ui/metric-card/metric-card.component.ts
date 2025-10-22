import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-metric-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="metric-card">
      <p class="metric-label">{{ label }}</p>
      <h3 class="metric-value">{{ value }}</h3>
    </div>
  `,
  styles: [`
    .metric-card {
      background: var(--bg); color: var(--fg);
      box-shadow: var(--elev-1);
      border-radius: var(--radius-xl);
      padding: 1.5rem;
      border-top: 4px solid var(--primary);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
    }
    .metric-label { font-size: .875rem; color: var(--neutral-600); margin-bottom: .25rem; }
    .metric-value { font-size: 1.875rem; font-weight: 800; color: var(--primary); }
  `]
})
export class MetricCardComponent {
  @Input() label!: string;
  @Input() value!: number | string;
}

