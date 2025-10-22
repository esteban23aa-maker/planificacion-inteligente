import { Component, ViewEncapsulation, HostBinding, inject } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';

// Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

// UI
import { PageHeaderComponent } from 'src/app/ui/page-header/page-header.component';
import { ConfirmDialogComponent } from 'src/app/features/programacion/dialogs/confirm-dialog.component';
import { IfRolesDirective } from 'src/app/shared/directives/if-roles.directive';

// Env
import { environment } from 'src/environments/environment';

type Density = 'comfortable' | 'compact' | 'ultra';

interface EntidadItem {
  nombre: string;
  ruta: string;
  icon: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-carga-inicial',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatButtonToggleModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatDividerModule,
    MatCardModule,
    MatDialogModule,
    PageHeaderComponent,
    IfRolesDirective // ✅ directiva unificada
  ],
  templateUrl: './carga-inicial.component.html',
  styleUrls: ['./carga-inicial.component.css'],
  encapsulation: ViewEncapsulation.None,
  host: { class: 'carga-inicial-page' }
})
export class CargaInicialComponent {

  // ===== Injections
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private auth = inject(AuthService);

  // ===== Navegación principal
  entidades: EntidadItem[] = [
    { nombre: 'Colaboradores', ruta: '/crear-colaborador', icon: 'group' },
    { nombre: 'Máquinas', ruta: '/crear-maquina', icon: 'precision_manufacturing' },
    { nombre: 'Puestos', ruta: '/crear-puesto', icon: 'work' },
    { nombre: 'Turnos', ruta: '/crear-turno', icon: 'schedule', adminOnly: true },
    { nombre: 'Roles', ruta: '/crear-rol', icon: 'badge', adminOnly: true }
  ];

  trackByRuta = (_: number, item: EntidadItem) => item.ruta;

  // ===== Estado/resultado
  mensaje = '';
  exito = false;
  fullscreenLoading = false;

  // ===== Densidad
  density: Density = (localStorage.getItem('cargaInicial.density') as Density) || 'comfortable';
  @HostBinding('class.density-compact') get _isCompact() { return this.density === 'compact'; }
  @HostBinding('class.density-ultra') get _isUltra() { return this.density === 'ultra'; }
  setDensity(d: Density) {
    this.density = d;
    localStorage.setItem('cargaInicial.density', d);
  }

  // ===== Header
  get subtitle(): string {
    const hoy = new Date();
    return `Actualizado al ${formatDate(hoy, "d 'de' MMMM 'de' y, h:mm a", 'es-CO')}`;
  }

  // ===== Acciones solo ADMIN
  async eliminarTodo(): Promise<void> {
    if (!this.auth.hasRole('ADMIN')) {
      this.toast('Acción disponible solo para ADMIN');
      return;
    }

    const ok1 = await this.confirmar(
      '¿Eliminar TODOS los datos iniciales?',
      'Esta acción no se puede deshacer.'
    );
    if (!ok1) return;

    const ok2 = await this.confirmar(
      'Confirmación final',
      'Se eliminarán colaboradores, máquinas, puestos, turnos y roles. ¿Seguro que deseas continuar?'
    );
    if (!ok2) return;

    this.fullscreenLoading = true;
    const url = `${environment.apiUrl}/carga-inicial?usuario=admin`;

    this.http.delete(url, { responseType: 'text' }).subscribe({
      next: (respuesta: string) => {
        this.mensaje = respuesta;
        this.exito = true;
        this.toast('🧹 Datos eliminados correctamente.', true);
      },
      error: (err) => {
        console.error(err);
        this.mensaje = '❌ Ocurrió un error al eliminar los datos.';
        this.exito = false;
        this.toast(this.mensaje);
      },
      complete: () => (this.fullscreenLoading = false)
    });
  }

  // ===== Helpers UI
  private toast(msg: string, ok = false) {
    this.snack.open(msg, ok ? 'OK' : 'Cerrar', { duration: ok ? 2200 : 3500 });
  }

  private confirmar(titulo: string, mensaje: string): Promise<boolean> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: { title: titulo, message: mensaje, confirmText: 'Confirmar', cancelText: 'Cancelar' }
    });
    return firstValueFrom(ref.afterClosed()).then((v) => !!v);
  }
}
