/**
 * services/friendService.js — amis (inviter plus facilement)
 */
import { apiClient } from './apiClient';

const friendService = {
  list: async () => (await apiClient.get('/api/friends/')).data,
  request: async (userId) => (await apiClient.post('/api/friends/requests/', { user_id: userId })).data,
  accept: async (id) => (await apiClient.post(`/api/friends/requests/${id}/accept/`)).data,
  remove: async (id) => apiClient.delete(`/api/friends/requests/${id}/`),
};

export default friendService;
