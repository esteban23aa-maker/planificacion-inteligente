export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081/api',
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
