import api from './api';
export const uploadApi = {
  upload: (type, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/upload/${type}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  listFiles: (params = {}) => api.get('/upload/files', { params }),
  getFileById: (id) => api.get(`/upload/files/${id}`),
  uploadWithSupersedes: (type, file, supersedesId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (supersedesId) formData.append('supersedes', supersedesId);
    return api.post(`/upload/${type}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};
