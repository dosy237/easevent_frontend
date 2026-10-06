/**
 * services/notificationService.js — Easevent (M17)
 */
import { apiClient } from './apiClient';

const notificationService = {
  list: async ({ category = 'all', before } = {}) =>
    (await apiClient.get('/api/notifications/', { params: { category, ...(before ? { before } : {}) } })).data,
  unreadCount: async () => (await apiClient.get('/api/notifications/unread-count/')).data.unread,
  markRead: async (id) => (await apiClient.post(`/api/notifications/${id}/read/`)).data,
  markAllRead: async (category) =>
    (await apiClient.post('/api/notifications/read-all/', category && category !== 'all' ? { category } : {})).data,
  preferences: async () => (await apiClient.get('/api/notifications/preferences/')).data,
  updatePreferences: async (prefs) => (await apiClient.patch('/api/notifications/preferences/', prefs)).data,
};

export default notificationService;
