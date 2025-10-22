export const environment = {
  production: true,
  apiUrl: 'https://invigorating-reverence-production.up.railway.app/api',  // <-- URL de Railway
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout'
  },
  security: {
    tokenHeader: 'Authorization',
    tokenPrefix: 'Bearer '
  }
};
