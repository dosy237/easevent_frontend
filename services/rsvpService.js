import { apiClient } from './apiClient';

/**
 * rsvpService.js — Questions RSVP (M14 organisateur, M19 invité)
 */
const base = (eventId) => `/api/events/${eventId}/rsvp-questions/`;

const rsvpService = {
  // Organisateur
  list:    async (eventId) => (await apiClient.get(base(eventId))).data,
  create:  async (eventId, question) => (await apiClient.post(base(eventId), question)).data,
  update:  async (eventId, id, question) => (await apiClient.patch(`${base(eventId)}${id}/`, question)).data,
  remove:  async (eventId, id) => (await apiClient.delete(`${base(eventId)}${id}/`)).data,
  reorder: async (eventId, order) => (await apiClient.post(`${base(eventId)}reorder/`, { order })).data,
  summary: async (eventId) => (await apiClient.get(`/api/events/${eventId}/rsvp-answers/`)).data,
  // Invité : mes réponses (consulter / modifier après avoir accepté)
  mine:    async (eventId) => (await apiClient.get(`/api/events/${eventId}/rsvp/`)).data,
  saveMine: async (eventId, answers) => (await apiClient.post(`/api/events/${eventId}/rsvp/`, { answers })).data,
};

export default rsvpService;
