export const environment = {
  production: false,
  apiUrl: 'https://invigorating-reverence-production.up.railway.app/api',
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
  },
  security: {
    tokenHeader: 'Authorization',
    tokenPrefix: 'Bearer ',
  },
} as const;
