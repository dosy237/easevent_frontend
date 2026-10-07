/**
 * services/messageService.js — Easevent (M15 / M16)
 */
import { Platform } from 'react-native';
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
  // Photo / capture d'écran (asset d'expo-image-picker)
  sendImage: async (id, asset, caption = '') => {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(asset.uri)).blob();
      form.append('image', blob, asset.fileName || 'photo.jpg');
    } else {
      form.append('image', { uri: asset.uri, name: asset.fileName || 'photo.jpg', type: asset.mimeType || 'image/jpeg' });
    }
    if (caption) form.append('body', caption);
    return (await apiClient.post(`/api/conversations/${id}/messages/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },
  // Itinéraire jusqu'au lieu de l'événement
  sendLocation: async (id) => (await apiClient.post(`/api/conversations/${id}/messages/`, { kind: 'location' })).data,
};

export default messageService;
