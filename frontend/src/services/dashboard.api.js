import api from './api';
export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  denialReasons: (limit = 10) => api.get(`/dashboard/denial-reasons?limit=${limit}`),
  trends: (days = 30) => api.get(`/dashboard/trends?days=${days}`),
  payerBreakdown: () => api.get('/dashboard/payer-breakdown'),
  aging: () => api.get('/dashboard/aging'),
};
