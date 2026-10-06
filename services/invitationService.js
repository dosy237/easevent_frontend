/**
 * services/invitationService.js — Easevent (lot Invitations)
 * ════════════════════════════════════════════════════════════════
 * M12 / M29 : envoyer des invitations (membres, emails, téléphones)
 * M13       : invités & réponses, relances, révocation, export
 * M31       : lien d'invitation (public) et rattachement au compte
 * ════════════════════════════════════════════════════════════════
 */
import { apiClient } from './apiClient';

const invitationService = {
  // ── Organisateur ────────────────────────────────────────────
  invite: async (eventId, { emails = [], phoneNumbers = [], userIds = [], message = '' }) =>
    (await apiClient.post(`/api/events/${eventId}/invite/`, {
      emails, phone_numbers: phoneNumbers, user_ids: userIds, message,
    })).data,
  participants: async (eventId) => (await apiClient.get(`/api/events/${eventId}/participants/`)).data,
  remind: async (invitationId) => (await apiClient.post(`/api/invitations/${invitationId}/remind/`)).data,
  remindPending: async (eventId) => (await apiClient.post(`/api/events/${eventId}/remind-pending/`)).data,
  revoke: async (invitationId) => (await apiClient.delete(`/api/invitations/${invitationId}/revoke/`)).data,
  exportLink: async (eventId) => (await apiClient.post(`/api/events/${eventId}/participants/export-link/`)).data,

  // ── Annuaire ────────────────────────────────────────────────
  searchUsers: async (q, eventId) =>
    (await apiClient.get('/api/users/search/', { params: { q, event: eventId } })).data.results,
  lookupEmails: async (emails) => (await apiClient.post('/api/users/lookup/', { emails })).data.results,

  // ── Lien d'invitation (M31) ─────────────────────────────────
  byToken: async (token) => (await apiClient.get(`/api/invitations/by-token/${encodeURIComponent(token)}/`)).data,
  declineByToken: async (token) =>
    (await apiClient.post(`/api/invitations/by-token/${encodeURIComponent(token)}/decline/`)).data,
  claim: async (token) => (await apiClient.post('/api/invitations/claim/', { token })).data,
};

export default invitationService;
