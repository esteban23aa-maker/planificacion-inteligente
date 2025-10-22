import { Component, OnInit, ViewChild, ElementRef, ViewChildren, QueryList, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';

import { MaquinasService } from 'src/app/core/services/maquinas.service';
import { Maquina } from 'src/app/core/models/maquina.model';
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-crear-maquina',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './crear-maquina.component.html',
  styleUrls: ['./crear-maquina.component.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'crear-maquina-page' }
})
export class CrearMaquinaComponent implements OnInit {
  @ViewChild('formularioRef') formularioRef!: ElementRef;
  @ViewChildren('filaMaquinaRef') filasMaquinas!: QueryList<ElementRef>;

  maquinas: Maquina[] = [];
  nueva: Maquina = this.nuevaMaquina();
  maquinasExcel: { nombre: string; tipo: string; activa: boolean }[] = [];
  tipos: string[] = ['Formacion', 'Pulidora', 'Horno'];

  editando = false;
  maquinaEditadaId: number | null = null;

  constructor(private maquinasService: MaquinasService) { }

  ngOnInit(): void {
    this.cargarMaquinas();
  }

  cargarMaquinas(): void {
    this.maquinasService.getAll().subscribe(data => {
      this.maquinas = data;

      // Resaltar/scroll si venimos de guardar/editar
      setTimeout(() => {
        if (this.maquinaEditadaId !== null) {
          const fila = this.filasMaquinas.find(
            f => f.nativeElement.getAttribute('data-id') === String(this.maquinaEditadaId)
          );
          if (fila) {
            fila.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            fila.nativeElement.classList.add('resaltado');
            setTimeout(() => fila.nativeElement.classList.remove('resaltado'), 2000);
          }
          this.maquinaEditadaId = null;
        }
      }, 220);
    });
  }

  guardar(): void {
    if (!this.nueva.nombre?.trim() || !this.nueva.tipo?.trim()) {
      alert('Debe completar nombre y tipo.');
      return;
    }

    const op = this.editando && this.nueva.id
      ? this.maquinasService.update(this.nueva.id, this.nueva)
      : this.maquinasService.save(this.nueva);

    if (this.nueva.id) this.maquinaEditadaId = this.nueva.id;

    op.subscribe(() => {
      this.cancelar();
      this.cargarMaquinas();
      setTimeout(() => {
        document.querySelector('.list-scroll')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    });
  }

  editar(maquina: Maquina): void {
    this.nueva = { ...maquina };
    this.editando = true;
    this.maquinaEditadaId = maquina.id ?? null;

    setTimeout(() => {
      this.formularioRef?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  eliminar(id: number): void {
    if (confirm('¿Eliminar esta máquina?')) {
      this.maquinasService.delete(id).subscribe(() => this.cargarMaquinas());
    }
  }

  cancelar(): void {
    this.nueva = this.nuevaMaquina();
    this.editando = false;
  }

  subirExcel(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet);

      this.maquinasExcel = rows
        .map(r => ({
          nombre: (r['Nombre'] ?? '').toString().trim(),
          tipo: (r['Tipo'] ?? '').toString().trim(),
          activa: (r['Activa'] ?? '').toString().trim().toLowerCase() === 'sí'
        }))
        .filter(m => m.nombre && m.tipo);
    };
    reader.readAsArrayBuffer(file);
  }

  importarDesdeExcel(): void {
    if (!this.maquinasExcel.length) return;
    if (!confirm(`¿Deseas importar ${this.maquinasExcel.length} máquinas?`)) return;

    const peticiones = this.maquinasExcel.map(m => this.maquinasService.save(m));
    forkJoin(peticiones).subscribe({
      next: () => {
        this.maquinasExcel = [];
        this.cargarMaquinas();
      },
      error: () => alert('Ocurrió un error durante la importación.')
    });
  }

  trackById = (_: number, m: Maquina) => m.id ?? m.nombre;

  private nuevaMaquina(): Maquina {
    return { nombre: '', tipo: '', activa: true };
  }
}
