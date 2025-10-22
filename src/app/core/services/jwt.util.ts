export function decodeJwt(token: string): any | null {
  try {
    const payload = token.split('.')[1];
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(normalized)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}


export function getTokenExp(token: string): number | undefined {
  const decoded = decodeJwt(token);
  return decoded?.exp as number | undefined;
}


export function isExpired(exp?: number, skewSeconds = 10): boolean {
  if (!exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return now >= (exp - skewSeconds);
}


export function hasRole(roles: string[] | undefined, ...required: string[]): boolean {
  if (!roles || roles.length === 0) return false;
  return required.some(r => roles.includes(r) || roles.includes('ROLE_' + r));
}
