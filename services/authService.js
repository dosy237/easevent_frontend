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
  }
};
