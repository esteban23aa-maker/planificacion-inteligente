import { Pipe, PipeTransform } from '@angular/core';
import { ColaboradorDetallado } from '../../core/models/colaborador-detallado.model';
import { Rol } from '../../core/models/rol.model';
import { Maquina } from '../../core/models/maquina.model';

@Pipe({
  name: 'filtroColaboradores',
  standalone: true
})
export class FiltroColaboradoresPipe implements PipeTransform {

  /** Normaliza: quita tildes/diacríticos, pasa a minúsculas y recorta */
  private norm(s: unknown): string {
    return (s ?? '')
      .toString()
      .normalize('NFD')                 // separa letra + acento
      .replace(/[\u0300-\u036f]/g, '')  // elimina marcas combinantes (tildes)
      .toLowerCase()
      .trim();
  }

  /** includes sin acentos */
  private includesFold(haystack: unknown, needle: unknown): boolean {
    const h = this.norm(haystack);
    const n = this.norm(needle);
    return !n || h.includes(n);
  }

  /** igualdad exacta sin acentos */
  private equalsFold(a: unknown, b: unknown): boolean {
    return this.norm(a) === this.norm(b);
  }

  transform(
    colaboradores: ColaboradorDetallado[],
    filtroNombre: string,
    filtroPuedeReemplazar: Rol | null,
    filtroCoordinadorId: number | null = null,
    filtroGrupo: string | null = null,
    filtroMaquinaPrincipal: Maquina | null = null,
    filtroSinAsignacion: boolean = false
  ): ColaboradorDetallado[] {
    return (colaboradores || []).filter(c => {
      const coincideNombre = this.includesFold(c?.nombre, filtroNombre);
      const coincideRol = !filtroPuedeReemplazar || (c.puedeReemplazar ?? []).some(r => r.id === filtroPuedeReemplazar.id);
      const coincideCoordinador = !filtroCoordinadorId || c.coordinadorId === filtroCoordinadorId;
      const coincideGrupo = !filtroGrupo || this.equalsFold(c.grupo ?? '', filtroGrupo);
      const coincideMaquina = !filtroMaquinaPrincipal || c.maquina?.id === filtroMaquinaPrincipal.id;

      // "Sin asignación" = sin grupo o sin coordinador
      const sinGrupo = !(c.grupo && c.grupo.trim());
      const sinCoord = !c.coordinadorId;
      if (filtroSinAsignacion && !(sinGrupo || sinCoord)) return false;

      return coincideNombre && coincideRol && coincideCoordinador && coincideGrupo && coincideMaquina;
    });
  }
}
