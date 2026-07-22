import api from './api';

export const remittancesApi = {
  list: (params) => api.get('/remittances', { params }),
  get: (id) => api.get(`/remittances/${id}`),
};
