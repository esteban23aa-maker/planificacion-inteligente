import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, timer } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { AuthRequest, AuthResponse, UserSession } from '../models/auth.models';
import { environment } from '../../../environments/environment';
import { TokenStorageService } from './token-storage.service';
import { decodeJwt, getTokenExp, isExpired } from './jwt.util';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private storage = inject(TokenStorageService);

  private _session$ = new BehaviorSubject<UserSession | null>(null);
  readonly session$ = this._session$.asObservable();

  private refreshInFlight = false;

  constructor() {
    this.storage.loadFromStorage();
    if (this.storage.session?.accessToken) {
      this._session$.next(this.storage.session);
      this.scheduleAccessRefresh();
    }
  }

  login(req: AuthRequest, remember = true): Observable<UserSession> {
    const url = `${environment.apiUrl}${environment.auth.login}`;
    return this.http.post<AuthResponse>(url, req).pipe(
      map(res => {
        const payload = decodeJwt(res.accessToken);
        const roles = (payload?.roles as string[] | undefined) ?? [];
        const username = payload?.sub ?? req.username;
        const accessExp = getTokenExp(res.accessToken);
        const session: UserSession = {
          username,
          roles,
          accessToken: res.accessToken,
          refreshToken: res.refreshToken ?? null,
          accessExp
        };
        return session;
      }),
      tap(session => {
        this.storage.saveSession(session, remember);
        this._session$.next(session);
        this.scheduleAccessRefresh();
      })
    );
  }

  refresh(): Observable<string> {
    if (this.refreshInFlight) {
      // pequeño backoff: espera 500 ms y re‑lee token
      return timer(500).pipe(map(() => this.storage.accessToken as string));
    }
    this.refreshInFlight = true;

    const r = this.storage.refreshToken;
    if (!r) return throwError(() => new Error('No refresh token'));

    const url = `${environment.apiUrl}${environment.auth.refresh}`;
    return this.http.post<AuthResponse>(url, { refreshToken: r }).pipe(
      tap(res => {
        const payload = decodeJwt(res.accessToken);
        const roles = (payload?.roles as string[] | undefined) ?? this._session$.value?.roles ?? [];
        const username = payload?.sub ?? this._session$.value?.username ?? '';
        const accessExp = getTokenExp(res.accessToken);
        const session: UserSession = {
          username,
          roles,
          accessToken: res.accessToken,
          refreshToken: res.refreshToken ?? r,
          accessExp
        };
        this.storage.saveSession(session, true);
        this._session$.next(session);
        this.scheduleAccessRefresh();
      }),
      map(res => res.accessToken),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      }),
      tap(() => { this.refreshInFlight = false; })
    );
  }

  logout(): void {
    const url = `${environment.apiUrl}${environment.auth.logout}`;
    const refreshToken = this.storage.refreshToken;
    if (refreshToken) {
      // fire‑and‑forget (si falla, igual limpiamos)
      this.http.post(url, { refreshToken }).subscribe({ complete: () => { } });
    }
    this.storage.clear();
    this._session$.next(null);
  }
  get roles(): string[] {
    return this._session$.value?.roles ?? [];
  }

  isAuthenticated(): boolean {
    const s = this._session$.value;
    if (!s?.accessToken) return false;
    return !isExpired(s.accessExp);
  }

  hasRole(...roles: string[]): boolean {
    if (!this._session$.value) return false;
    const userRoles = this._session$.value.roles ?? [];
    return userRoles.some(r => {
      const clean = r.startsWith('ROLE_') ? r.substring(5) : r;
      return roles.includes(r) || roles.includes(clean);
    });
  }

  get accessToken(): string | null { return this._session$.value?.accessToken ?? null; }

  private scheduleAccessRefresh(): void {
    const exp = this._session$.value?.accessExp;
    if (!exp) return;
    const now = Math.floor(Date.now() / 1000);
    const delta = Math.max(exp - now - 15, 1); // refrescar 15s antes
    // programar un refresh silencioso
    timer(delta * 1000).pipe(
      switchMap(() => this.refresh())
    ).subscribe({
      error: () => this.logout()
    });
  }
  hasAnyRole(roles: string[] | string): boolean {
    const arr = Array.isArray(roles) ? roles : [roles];
    return this.hasRole(...arr);
  }
  hasAllRoles(roles: string[]): boolean {
    return roles.every(r => this.hasRole(r));
  }

}
