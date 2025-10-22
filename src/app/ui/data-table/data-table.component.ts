import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn {
  field: string;
  header: string;
}

@Component({
  selector: 'ui-data-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="overflow-x-auto rounded-xl border border-[var(--neutral-200)]">
      <table class="w-full text-sm text-left border-collapse">
        <thead class="bg-[var(--neutral-100)]">
          <tr>
            <th *ngFor="let col of columns" class="px-4 py-2 font-semibold text-[var(--neutral-700)]">
              {{ col.header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let row of data" class="border-t border-[var(--neutral-200)] hover:bg-[var(--neutral-50)]">
            <td *ngFor="let col of columns" class="px-4 py-2">
              {{ row[col.field] }}
            </td>
          </tr>
        </tbody>
      </table>
      <div *ngIf="!data || data.length === 0" class="text-center py-6 text-[var(--neutral-500)]">
        {{ emptyMessage }}
      </div>
    </div>
  `,
})
export class DataTableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[] = [];
  @Input() emptyMessage: string = 'No hay registros';
}
