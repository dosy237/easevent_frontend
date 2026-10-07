/**
 * services/teamService.js — cogestion, statistiques, souvenirs, message à tous, finances
 */
import { Platform } from 'react-native';
import { apiClient } from './apiClient';

const base = (eventId) => `/api/events/${eventId}`;

const teamService = {
  // Équipe : co-organisateurs (gèrent tout) et photographes (photos seulement)
  team: async (eventId) => (await apiClient.get(`${base(eventId)}/team/`)).data,
  addMember: async (eventId, userId, role) =>
    (await apiClient.post(`${base(eventId)}/team/`, { user_id: userId, role })).data,
  removeMember: async (eventId, collabId) => apiClient.delete(`${base(eventId)}/team/${collabId}/`),
  // split : { user_id: nombre } ; ou apply = 'proposed' pour la répartition équitable
  setSplit: async (eventId, split) =>
    (await apiClient.put(`${base(eventId)}/team/split/`, split === 'proposed' ? { apply: 'proposed' } : { split })).data,
  invitations: async () => (await apiClient.get('/api/events/team/invitations/')).data.results,
  respond: async (collabId, accept) => (await apiClient.post(`/api/events/team/${collabId}/respond/`, { accept })).data,

  // Message à tous les invités
  broadcastInfo: async (eventId) => (await apiClient.get(`${base(eventId)}/broadcast/`)).data,
  broadcast: async (eventId, message) => (await apiClient.post(`${base(eventId)}/broadcast/`, { message })).data,

  // Statistiques et présence réelle
  stats: async (eventId) => (await apiClient.get(`${base(eventId)}/stats/`)).data,
  attendance: async (eventId, count) => (await apiClient.post(`${base(eventId)}/attendance/`, { count })).data,

  // Finances (organisateur, événement payant)
  finance: async (eventId) => (await apiClient.get(`${base(eventId)}/finance/`)).data,

  // Espace souvenirs
  comments: async (eventId) => (await apiClient.get(`${base(eventId)}/comments/`)).data,
  addComment: async (eventId, body) => (await apiClient.post(`${base(eventId)}/comments/`, { body })).data,
  deleteComment: async (eventId, id) => apiClient.delete(`${base(eventId)}/comments/${id}/`),
  memories: async (eventId) => (await apiClient.get(`${base(eventId)}/memories/`)).data,
  addPhoto: async (eventId, asset, caption = '') => {
    const form = new FormData();
    if (Platform.OS === 'web') {
      const blob = await (await fetch(asset.uri)).blob();
      form.append('image', blob, asset.fileName || 'photo.jpg');
    } else {
      form.append('image', { uri: asset.uri, name: asset.fileName || 'photo.jpg', type: asset.mimeType || 'image/jpeg' });
    }
    if (caption) form.append('caption', caption);
    return (await apiClient.post(`${base(eventId)}/memories/`, form, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
  },
  deletePhoto: async (eventId, id) => apiClient.delete(`${base(eventId)}/memories/${id}/`),
};

export default teamService;
