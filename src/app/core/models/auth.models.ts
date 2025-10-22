export interface AuthRequest {
  username: string;
  password: string;
}


export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string; // "Bearer"
  expiresIn: number; // ms (del access)
}


export interface JwtPayload {
  sub: string; // username
  roles?: string[]; // ej. ["ROLE_ADMIN","ROLE_USER"]
  exp?: number; // epoch seconds
  iat?: number;
  [k: string]: unknown;
}


export interface UserSession {
  username: string;
  roles: string[];
  accessToken: string;
  refreshToken: string | null;
  accessExp?: number; // epoch seconds
}
