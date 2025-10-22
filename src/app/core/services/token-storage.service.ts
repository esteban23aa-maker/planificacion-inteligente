import { Injectable } from '@angular/core';
import { UserSession } from '../models/auth.models';


const ACCESS_KEY = 'pi_access_token';
const REFRESH_KEY = 'pi_refresh_token';
const SESSION_KEY = 'pi_session';


@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  // En memoria (más seguro ante XSS que leer siempre de localStorage)
  private _access: string | null = null;
  private _refresh: string | null = null;
  private _session: UserSession | null = null;


  loadFromStorage(): void {
    this._access = localStorage.getItem(ACCESS_KEY);
    this._refresh = localStorage.getItem(REFRESH_KEY);
    const s = localStorage.getItem(SESSION_KEY);
    this._session = s ? JSON.parse(s) : null;
  }


  saveSession(session: UserSession, remember = true): void {
    this._session = session;
    this._access = session.accessToken;
    this._refresh = session.refreshToken;
    if (remember) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(ACCESS_KEY, session.accessToken);
      if (session.refreshToken) localStorage.setItem(REFRESH_KEY, session.refreshToken);
    }
  }


  clear(): void {
    this._session = null;
    this._access = null;
    this._refresh = null;
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }


  get accessToken(): string | null { return this._access; }
  set accessToken(t: string | null) {
    this._access = t;
    if (t) localStorage.setItem(ACCESS_KEY, t); else localStorage.removeItem(ACCESS_KEY);
  }


  get refreshToken(): string | null { return this._refresh; }
  set refreshToken(t: string | null) {
    this._refresh = t;
    if (t) localStorage.setItem(REFRESH_KEY, t); else localStorage.removeItem(REFRESH_KEY);
  }


  get session(): UserSession | null { return this._session; }
}
