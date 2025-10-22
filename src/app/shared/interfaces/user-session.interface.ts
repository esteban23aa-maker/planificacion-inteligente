// src/app/shared/interfaces/user-session.interface.ts  (puedes mantener esta ruta si prefieres)
export interface UserSession {
  username: string;
  roles: string[];         // << antes era 'role: string'
  accessToken: string;
  refreshToken: string | null;
  accessExp?: number;      // epoch seconds
}
