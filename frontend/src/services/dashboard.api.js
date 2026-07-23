import api from './api';
export const dashboardApi = {
  summary: () => api.get('/dashboard/summary'),
  denialReasons: (limit = 10) => api.get(`/dashboard/denial-reasons?limit=${limit}`),
  trends: (days = 30) => api.get(`/dashboard/trends?days=${days}`),
  payerBreakdown: (page = 1, limit = 10) => api.get(`/dashboard/payer-breakdown?page=${page}&limit=${limit}`),
  aging: () => api.get('/dashboard/aging'),
};
