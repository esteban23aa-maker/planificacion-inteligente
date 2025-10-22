import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolesService } from 'src/app/core/services/roles.service';
import { Rol } from 'src/app/core/models/rol.model';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-crear-rol',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crear-rol.component.html',
  styleUrls: ['./crear-rol.component.css']
})
export class CrearRolComponent implements OnInit {
  roles: Rol[] = [];
  nuevo: Rol = this.nuevoRol();
  editando = false;

  constructor(private rolesService: RolesService) { }

  ngOnInit(): void {
    this.cargarRoles();
  }

  cargarRoles(): void {
    this.rolesService.getAll().subscribe(data => this.roles = data);
  }

  guardar(): void {
    if (!this.nuevo.nombre || !this.nuevo.descripcion) {
      alert('Debe completar nombre y descripción');
      return;
    }

    this.rolesService.save(this.nuevo).subscribe(() => {
      this.cancelar();
      this.cargarRoles();
    });
  }

  editar(rol: Rol): void {
    this.nuevo = { ...rol };
    this.editando = true;
  }

  eliminar(id: number): void {
    if (confirm('¿Eliminar este rol?')) {
      this.rolesService.delete(id).subscribe(() => this.cargarRoles());
    }
  }

  cancelar(): void {
    this.nuevo = this.nuevoRol();
    this.editando = false;
  }

  sincronizar(): void {
    if (confirm('¿Desea sincronizar todos los puestos como roles?')) {
      this.rolesService.sincronizarDesdePuestos().subscribe({
        next: () => {
          alert('✅ Puestos sincronizados correctamente como roles.');
          this.cargarRoles();
        },
        error: err => {
          console.error(err);
          alert('❌ Error al sincronizar puestos con roles.');
        }
      });
    }
  }

  exportarExcel(): void {
    const datos = this.roles.map(r => ({
      ID: r.id,
      Nombre: r.nombre,
      Descripción: r.descripcion
    }));

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(datos);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Roles');
    XLSX.writeFile(wb, 'roles.xlsx');
  }

  private nuevoRol(): Rol {
    return {
      nombre: '',
      descripcion: ''
    };
  }
}
