import { apiClient } from './apiClient';

export const authService = {
  login: async (email, password) => {
    const response = await apiClient.post('/api/auth/login/', { email, password });
    return response.data;
  },

  register: async (userData) => {
    const response = await apiClient.post('/api/auth/register/', userData);
    return response.data;
  },

  refreshToken: async (refresh) => {
    const response = await apiClient.post('/api/auth/token/refresh/', { refresh });
    return response.data;
  },

  getProfile: async () => {
    const response = await apiClient.get('/api/auth/profile/');
    return response.data;
  },

  updateProfile: async (userData) => {
    const response = await apiClient.patch('/api/auth/me/update/', userData);
    return response.data;
  },

  changePassword: async (passwords) => {
    const response = await apiClient.post('/api/auth/change-password/', passwords);
    return response.data;
  },

  deleteAccount: async (password) => {
    const response = await apiClient.post('/api/auth/delete-account/', { password });
    return response.data;
  }
};
