import api from './api';
export const uploadApi = {
  upload: (type, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/upload/${type}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  listFiles: () => api.get('/upload/files'),
};
