import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'grupoDisplay',
  standalone: true
})
export class GrupoDisplayPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    switch ((value || '').toUpperCase()) {
      case 'Y1': return 'COMPENSATORIO';
      case 'Y2': return 'REDUCCIÓN';
      case 'TITULAR': return 'TITULAR';
      default: return value || '';
    }
  }
}
