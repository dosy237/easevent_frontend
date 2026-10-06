/**
 * services/messageService.js — Easevent (M15 / M16)
 */
import { apiClient } from './apiClient';

const messageService = {
  list: async ({ eventId, q } = {}) =>
    (await apiClient.get('/api/conversations/', { params: { ...(eventId ? { event: eventId } : {}), ...(q ? { q } : {}) } })).data,
  open: async (eventId, participantId) =>
    (await apiClient.post('/api/conversations/', { event_id: eventId, ...(participantId ? { participant_id: participantId } : {}) })).data,
  unreadCount: async () => (await apiClient.get('/api/conversations/unread-count/')).data.unread,
  detail: async (id) => (await apiClient.get(`/api/conversations/${id}/`)).data,
  messages: async (id, { after, before } = {}) =>
    (await apiClient.get(`/api/conversations/${id}/messages/`, { params: { ...(after ? { after } : {}), ...(before ? { before } : {}) } })).data,
  send: async (id, body) => (await apiClient.post(`/api/conversations/${id}/messages/`, { body })).data,
  typing: async (id) => apiClient.post(`/api/conversations/${id}/typing/`),
};

export default messageService;
