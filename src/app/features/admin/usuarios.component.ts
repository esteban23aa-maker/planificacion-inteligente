import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Usuario } from '../../core/models/usuario.model';
import { UsuarioService } from '../../core/services/usuario.service';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  standalone: true,
  selector: 'app-usuarios',
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.scss'],
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ]
})
export class UsuariosComponent implements OnInit {
  private usuarioService = inject(UsuarioService);
  private dialog = inject(MatDialog);
  usuarios: Usuario[] = [];
  cols = ['username', 'roles', 'activo', 'acciones'];

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.usuarioService.listar().subscribe({
      next: data => this.usuarios = data,
      error: err => console.error('Error cargando usuarios', err)
    });
  }

  abrirCrear(): void {
    const username = prompt('Nuevo usuario:');
    const password = prompt('Contraseña:');
    const rol = prompt('Rol (ADMIN, SUPERVISOR, USER):');
    if (username && password && rol) {
      this.usuarioService.crear(username, password, rol).subscribe(() => this.cargar());
    }
  }

  abrirCambiarPassword(u: Usuario): void {
    const nuevaPassword = prompt(`Nueva contraseña para ${u.username}:`);
    if (nuevaPassword) {
      this.usuarioService.cambiarPassword(u.username, nuevaPassword)
        .subscribe(() => alert('Contraseña actualizada'));
    }
  }

  desactivar(u: Usuario): void {
    if (confirm(`¿Desactivar usuario ${u.username}?`)) {
      this.usuarioService.desactivar(u.id).subscribe(() => this.cargar());
    }
  }
}
