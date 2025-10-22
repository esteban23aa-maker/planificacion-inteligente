import { Component, Input } from '@angular/core';

@Component({
  selector: 'ui-page-header',
  standalone: true,
  template: `
    <div class="page-header">
      <h1 class="title">{{ title }}</h1>

      @if (subtitle) {
        <p class="subtitle">{{ subtitle }}</p>
      }

      @if (actions) {
        <div class="actions">
          <ng-content select="[actions]"></ng-content>
        </div>
      }
    </div>
  `,
  styles: [`
  .page-header {
    background: var(--brand-50);
    border: 1px solid var(--brand-100);
    box-shadow: var(--elev-1);
    border-radius: var(--radius-xl);
    padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
  }
  .title { font-size: 1.5rem; font-weight: 600; color: var(--brand-800); margin: 0; }
  .subtitle { font-size: .875rem; color: var(--brand-700); margin: .25rem 0 0 0; }
  .actions { margin-top: .75rem; display: flex; gap: .5rem; }
`]
})
export class PageHeaderComponent {
  @Input() title!: string;
  @Input() subtitle?: string;
  @Input() actions?: boolean;
}
