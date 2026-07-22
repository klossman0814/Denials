import api from './api';
export const claimsApi = {
  list: (params) => api.get('/claims', { params }),
  get: (id) => api.get(`/claims/${id}`),
  denials: (id) => api.get(`/claims/${id}/denials`),
};
