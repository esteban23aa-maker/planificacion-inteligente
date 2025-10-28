import { Component, ViewChild, inject } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule, NgFor, NgIf } from '@angular/common';

import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';

import { AuthService } from '../../core/services/auth.service';
import { IfRolesDirective } from '../../shared/directives/if-roles.directive';
import { Observable } from 'rxjs';
import { UserSession } from 'src/app/core/models/auth.models';

interface NavItem {
  label: string;
  icon: string;
  path: string;
  exact?: boolean;
  roles?: string[];
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule, NgFor, NgIf,
    RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatListModule, MatIconModule,
    MatButtonModule, MatToolbarModule, MatMenuModule, MatTooltipModule,
    IfRolesDirective
  ],
  templateUrl: './app-shell.component.html',
  styleUrls: ['./app-shell.component.scss']
})
export class AppShellComponent {
  private router = inject(Router);
  private auth = inject(AuthService);
  private bp = inject(BreakpointObserver);

  @ViewChild(MatSidenav, { static: true }) sidenav!: MatSidenav;

  session$: Observable<UserSession | null> = this.auth.session$;

  isMobile = false;
  opened = true;
  pinned = true;
  private openTimer: any;
  private closeTimer: any;

  readonly items: NavItem[] = [
    { label: 'Dashboard', icon: 'analytics', path: '/dashboard', exact: true },
    { label: 'Programación', icon: 'calendar_month', path: '/programacion' },
    { label: 'Domingos', icon: 'event', path: '/domingo' },
    { label: 'Compensatorios', icon: 'work_history', path: '/descansos-y1' },
    { label: 'Reducción', icon: 'timelapse', path: '/descansos-y2' },
    { label: 'Incidencias de reducción', icon: 'rule', path: '/admin/incidencias-y2', roles: ['ADMIN'] },
    { label: 'Sugerencias IA', icon: 'lightbulb', path: '/sugerencias', roles: ['ADMIN'] },
    { label: 'Colaboradores', icon: 'groups', path: '/colaboradores', roles: ['SUPERVISOR', 'ADMIN'] },
    { label: 'Historial', icon: 'history', path: '/historial', roles: ['SUPERVISOR', 'ADMIN'] },
    { label: 'Carga Inicial', icon: 'upload', path: '/carga-inicial', roles: ['SUPERVISOR', 'ADMIN'] },
    { label: 'Usuarios', icon: 'manage_accounts', path: '/admin/usuarios', roles: ['ADMIN'] },
  ];

  constructor() {
    this.bp.observe([Breakpoints.Medium, Breakpoints.Small, Breakpoints.XSmall]).subscribe(r => {
      this.isMobile = r.matches;
      if (this.isMobile) { this.pinned = false; this.opened = false; }
      else { this.opened = this.pinned; }
    });
  }

  // ===== Hover sidenav =====
  private get hoverEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: fine)').matches && !this.isMobile;
  }
  toggle(): void {
    this.pinned = !this.pinned;
    this.opened = this.pinned;
    this.clearTimers();
    if (this.pinned) this.sidenav.open(); else this.sidenav.close();
  }
  hoverOpen(): void {
    if (!this.hoverEnabled || this.pinned) return;
    clearTimeout(this.closeTimer);
    this.openTimer = setTimeout(() => { this.opened = true; this.sidenav.open(); }, 120);
  }
  cancelClose(): void { clearTimeout(this.closeTimer); }
  scheduleClose(): void {
    if (!this.hoverEnabled || this.pinned) return;
    clearTimeout(this.openTimer);
    this.closeTimer = setTimeout(() => { this.opened = false; this.sidenav.close(); }, 220);
  }
  private clearTimers(): void { clearTimeout(this.openTimer); clearTimeout(this.closeTimer); }

  // ===== Usuario: helpers UI robustos =====
  initials(str?: string): string {
    const s = (str || '').trim();
    if (!s) return 'U';
    const parts = s.replace(/[_.-]+/g, ' ').split(' ').filter(Boolean);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  /** Color estable HSL basado en hash del nombre/usuario */
  avatarStyle(str?: string): Record<string, string> {
    const h = this.hashToHue(str || '');
    return {
      background: `hsl(${h} 65% 40% / .18)`,
      border: `1px solid hsl(${h} 70% 65% / .55)`,
      color: '#fff'
    };
  }
  private hashToHue(s: string): number {
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }

  /** Nombre a mostrar (inteligente) */
  displayName(s?: UserSession | null): string {
    if (!s) return '';
    // si en tu payload existen “name”, “given_name” o “preferred_username”, puedes mapearlos en el AuthService
    const fallback = s.username || '';
    // Si viene email, muestra “local-part” capitalizado
    if (fallback.includes('@')) {
      const local = fallback.split('@')[0];
      return this.capitalizeWords(local.replace(/[._-]/g, ' '));
    }
    return this.capitalizeWords(fallback);
  }

  /** Línea secundaria: email si username contiene @, si no, rol principal */
  secondaryLine(s?: UserSession | null): string {
    if (!s) return '';
    if ((s.username || '').includes('@')) return s.username;
    const roles = this.prettyRoles(s.roles);
    return roles[0] ?? '';
  }

  prettyRoles(roles?: string[]): string[] {
    if (!roles?.length) return [];
    return roles.map(r => (r.startsWith('ROLE_') ? r.slice(5) : r)).map(x => x.toUpperCase());
  }

  private capitalizeWords(t: string): string {
    return t.split(' ').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  copyUser(u?: string): void {
    if (!u) return;
    navigator.clipboard?.writeText(u).catch(() => { });
  }

  // ===== Auth
  signOut(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
