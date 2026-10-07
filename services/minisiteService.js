/**
 * services/minisiteService.js — mini-sites IA (serveur : minisite/)
 */
import { apiClient } from './apiClient';

const base = (eventId) => `/api/events/${eventId}/minisite/`;

const minisiteService = {
  get: async (eventId) => (await apiClient.get(base(eventId))).data,                       // { spec, event, is_organizer }
  edit: async (eventId, changes) => (await apiClient.patch(base(eventId), changes)).data,  // { spec }
  generate: async (eventId) => (await apiClient.post(`${base(eventId)}generate/`, {})).data,
  generation: async (eventId) => (await apiClient.get(`${base(eventId)}generation/`)).data,
  choose: async (eventId, proposalId) => (await apiClient.post(`${base(eventId)}choose/`, { proposal_id: proposalId })).data,
};

export default minisiteService;
