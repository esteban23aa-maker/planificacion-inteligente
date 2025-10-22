import { Directive, Input, TemplateRef, ViewContainerRef, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';

@Directive({
  selector: '[ifRoles]',
  standalone: true,
})
export class IfRolesDirective implements OnDestroy {
  private rolesReq: string[] = [];
  private sub: Subscription;

  constructor(
    private tpl: TemplateRef<any>,
    private vcr: ViewContainerRef,
    private auth: AuthService
  ) {
    // 🔄 Re-render cuando cambie la sesión (login/logout/refresh)
    this.sub = this.auth.session$.subscribe(() => this.updateView());
  }

  @Input() set ifRoles(roles: string[] | string) {
    this.rolesReq = Array.isArray(roles) ? roles : [roles];
    this.updateView();
  }

  private updateView() {
    this.vcr.clear();
    // visible si el usuario tiene CUALQUIERA de los roles requeridos
    const canShow = this.rolesReq.length === 0 || this.auth.hasRole(...this.rolesReq);
    if (canShow) this.vcr.createEmbeddedView(this.tpl);
  }

  ngOnDestroy() { this.sub.unsubscribe(); }
}
