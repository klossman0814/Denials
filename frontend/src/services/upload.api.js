import api from './api';
export const uploadApi = {
  upload: (type, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/upload/${type}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  listFiles: (params = {}) => api.get('/upload/files', { params }),
  getFileById: (id) => api.get(`/upload/files/${id}`),
  getRawFile: async (id, filename) => {
    const res = await api.get(`/upload/files/${id}/raw`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'x12-document.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
  uploadWithSupersedes: (type, file, supersedesId) => {
    const formData = new FormData();
    formData.append('file', file);
    if (supersedesId) formData.append('supersedes', supersedesId);
    return api.post(`/upload/${type}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};
