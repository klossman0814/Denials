import api from './api';
export const mismatchesApi = {
  list: (params) => api.get('/mismatches', { params }),
};
