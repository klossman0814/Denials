import api from './api';
export const matchedClaimsApi = {
  list: (params) => api.get('/matched-claims', { params }),
};
