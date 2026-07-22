import api from './api';

export const denialsApi = {
  list: (params) => api.get('/denials', { params }),
};
