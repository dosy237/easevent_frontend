import { apiClient } from './apiClient';

export const authService = {
  login: async (email, password) => {
    const response = await apiClient.post('/api/auth/login/', { email, password });
    return response.data;
  },

  // userData : email, password, first_name, last_name,
  //            accepted_privacy, marketing_opt_in, invitation_token?
  register: async (userData) => {
    const response = await apiClient.post('/api/auth/register/', userData);
    return response.data;
  },

  logout: async (refresh) => {
    await apiClient.post('/api/auth/logout/', { refresh });
  },

  verifyEmail: async (token) => {
    const response = await apiClient.post('/api/auth/verify-email/', { token });
    return response.data;
  },

  resendVerification: async (email, channel = 'email') => {
    const response = await apiClient.post('/api/auth/resend-verification/', { email, channel });
    return response.data;
  },

  // Code à 6 chiffres reçu par email ou par SMS
  verifyCode: async ({ email, code, channel }) => {
    const response = await apiClient.post('/api/auth/verify-code/', { email, code, channel });
    return response.data;
  },

  requestPasswordReset: async (email) => {
    const response = await apiClient.post('/api/auth/password-reset/', { email });
    return response.data;
  },

  confirmPasswordReset: async ({ uid, token, newPassword }) => {
    const response = await apiClient.post('/api/auth/password-reset/confirm/', {
      uid, token, new_password: newPassword,
    });
    return response.data;
  },

  refreshToken: async (refresh) => {
    const response = await apiClient.post('/api/auth/token/refresh/', { refresh });
    return response.data;
  },

  getProfile: async () => {
    const response = await apiClient.get('/api/auth/me/');
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get('/api/auth/me/stats/');
    return response.data;
  },

  exportData: async () => {
    const response = await apiClient.get('/api/auth/me/export/');
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

/**
 * Message lisible à partir d'une erreur axios renvoyée par le backend.
 * Le backend renvoie { detail } ou { champ: 'message' }.
 */
export const apiErrorMessage = (err, fallback = 'Une erreur est survenue. Réessayez.') => {
  if (!err?.response) return 'Connexion impossible. Vérifiez votre réseau et réessayez.';
  if (err.response.status === 429) return 'Trop de tentatives. Patientez quelques minutes puis réessayez.';
  const data = err.response.data;
  if (!data || typeof data !== 'object') return fallback;
  if (typeof data.detail === 'string') return data.detail;
  const first = Object.values(data).find((v) => typeof v === 'string' || Array.isArray(v));
  if (Array.isArray(first)) return String(first[0]);
  return first || fallback;
};
