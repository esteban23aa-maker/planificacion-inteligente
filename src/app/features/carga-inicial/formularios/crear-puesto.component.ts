import {
  Component, OnInit, ViewChild, ElementRef, ViewChildren, QueryList, ViewEncapsulation
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';

import { Puesto } from 'src/app/core/models/puesto.model';
import { PuestosService } from 'src/app/core/services/puestos.service';
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Component({
  selector: 'app-crear-puesto',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent],
  templateUrl: './crear-puesto.component.html',
  styleUrls: ['./crear-puesto.component.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'crear-puesto-page' }
})
export class CrearPuestoComponent implements OnInit {
  @ViewChild('formularioRef') formularioRef!: ElementRef;
  @ViewChildren('filaPuestoRef') filasPuestos!: QueryList<ElementRef>;

  puestos: Puesto[] = [];
  puestosExcel: { nombre: string; descripcion: string; area: string }[] = [];
  nuevo: Puesto = this.reset();
  editando = false;
  puestoEditadoId: number | null = null;

  constructor(private puestosService: PuestosService) { }

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.puestosService.getAll().subscribe(data => {
      this.puestos = data;

      // Scroll y resaltado si venimos de guardar/editar
      setTimeout(() => {
        if (this.puestoEditadoId !== null) {
          const fila = this.filasPuestos.find(
            f => f.nativeElement.getAttribute('data-id') === String(this.puestoEditadoId)
          );
          if (fila) {
            fila.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            fila.nativeElement.classList.add('resaltado');
            setTimeout(() => fila.nativeElement.classList.remove('resaltado'), 1800);
          }
          this.puestoEditadoId = null;
        }
      }, 220);
    });
  }

  guardar(): void {
    if (!this.nuevo.nombre?.trim() || !this.nuevo.descripcion?.trim() || !this.nuevo.area?.trim()) {
      alert('Todos los campos son obligatorios.');
      return;
    }

    const op = this.editando && this.nuevo.id
      ? this.puestosService.update(this.nuevo.id, this.nuevo)
      : this.puestosService.save(this.nuevo);

    if (this.nuevo.id) this.puestoEditadoId = this.nuevo.id;

    op.subscribe(() => {
      this.cancelar();
      this.cargar();
      setTimeout(() => {
        document.querySelector('.list-scroll')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    });
  }

  editar(p: Puesto): void {
    this.nuevo = { ...p };
    this.editando = true;
    this.puestoEditadoId = p.id ?? null;

    setTimeout(() => {
      this.formularioRef?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  eliminar(id: number): void {
    if (confirm('¿Desea eliminar este puesto?')) {
      this.puestosService.delete(id).subscribe(() => this.cargar());
    }
  }

  cancelar(): void {
    this.nuevo = this.reset();
    this.editando = false;
  }

  exportarExcel(): void {
    const datos = this.puestos.map(p => ({
      ID: p.id, Nombre: p.nombre, Descripción: p.descripcion, Área: p.area
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Puestos');
    XLSX.writeFile(wb, 'puestos.xlsx');
  }

  subirExcel(event: any): void {
    const archivo = event.target.files?.[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      const filas: any[] = XLSX.utils.sheet_to_json(hoja, { defval: '' });

      this.puestosExcel = filas
        .map(row => ({
          nombre: (row['Nombre'] ?? '').toString().trim(),
          descripcion: (row['Descripción'] ?? '').toString().trim(),
          area: (row['Área'] ?? '').toString().trim()
        }))
        .filter(p => p.nombre && p.descripcion && p.area);
    };
    lector.readAsArrayBuffer(archivo);
  }

  cargarDesdeExcel(): void {
    if (!this.puestosExcel.length) return;
    if (!confirm(`¿Importar ${this.puestosExcel.length} puestos?`)) return;

    const ops = this.puestosExcel.map(p =>
      this.puestosService.save(p).pipe(
        map(() => true),
        catchError(() => of(false))
      )
    );

    forkJoin(ops).subscribe(res => {
      const ok = res.filter(v => v).length;
      const fail = res.length - ok;
      alert(`✅ Importación completada: ${ok} exitosos, ${fail} fallidos.`);
      this.puestosExcel = [];
      this.cargar();
    });
  }

  trackById = (_: number, p: Puesto) => p.id ?? p.nombre;

  private reset(): Puesto {
    return { nombre: '', descripcion: '', area: '' };
  }
}
