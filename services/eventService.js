import { withRsvp } from '../utils/rsvp';
import { apiClient } from './apiClient';
import { logDev } from '../utils/log';

/**
 * eventService.js
 * 
 * Manages all API calls related to events and invitations using the
 * authenticated Axios apiClient.
 */

const eventService = {
  // Fetch invitations received by the current user
  fetchMyInvitations: async () => {
    try {
      const response = await apiClient.get('/api/invitations/mine/');
      return response.data;
    } catch (error) {
      logDev('Error fetching invitations:', error);
      throw error;
    }
  },

  // Respond to an invitation (accept/decline)
  // Accepter affiche d'abord les questions RSVP de l'organisateur s'il y en a (M19)
  respondToInvitation: async (invitationId, status) => withRsvp(async (answers) => {
    const response = await apiClient.post(`/api/invitations/${invitationId}/repondre/`,
      answers === undefined ? { status } : { status, rsvp_answers: answers });
    return response.data;
  }),

  // Fetch events created by the current user
  fetchMyEvents: async () => {
    try {
      const response = await apiClient.get('/api/events/mes-evenements/');
      return response.data;
    } catch (error) {
      logDev('Error fetching my events:', error);
      throw error;
    }
  },

  fetchPublicEvents: async (params = {}) => {
    try {
      const response = await apiClient.get('/api/events/publics/', { params });
      return response.data;
    } catch (error) {
      logDev('Error fetching public events:', error);
      throw error;
    }
  },

  // Fetch single event detail
  fetchEventDetail: async (eventId) => {
    try {
      const response = await apiClient.get(`/api/events/${eventId}/detail/`);
      return response.data;
    } catch (error) {
      logDev('Error fetching event detail:', error);
      throw error;
    }
  },

  // Fetch participants for a specific event
  fetchEventParticipants: async (eventId) => {
    try {
      const response = await apiClient.get(`/api/events/${eventId}/participants/`);
      return response.data;
    } catch (error) {
      logDev('Error fetching event participants:', error);
      throw error;
    }
  },

  // Publish or unpublish an event
  publishEvent: async (eventId, visibility) => {
    try {
      const response = await apiClient.post(`/api/events/${eventId}/publish/`, { visibility });
      return response.data;
    } catch (error) {
      logDev('Error publishing event:', error);
      throw error;
    }
  },

  // « J'aime » (événements publics) : { liked, likes_count }
  like: async (eventId, on = true) =>
    (await (on ? apiClient.post(`/api/events/${eventId}/like/`) : apiClient.delete(`/api/events/${eventId}/like/`))).data,

  // Partager un événement public à des amis (carte dans leur messagerie)
  share: async (eventId, userIds, message = '') =>
    (await apiClient.post(`/api/events/${eventId}/share/`, { user_ids: userIds, message })).data,

  // Signature d'envoi direct d'une vidéo à Cloudinary (45 s au plus)
  videoSignature: async () => (await apiClient.post('/api/events/video/signature/')).data,

  // Événements restants ce mois-ci selon le plan : { limit, used, remaining, resets_on }
  fetchQuota: async () => (await apiClient.get('/api/events/quota/')).data,

  // Modifier un événement (PATCH partiel — organisateur uniquement)
  updateEvent: async (eventId, data) => {
    const response = await apiClient.patch(`/api/events/${eventId}/update/`, data);
    return response.data;
  },

  // Invite a participant
  inviteParticipant: async (eventId, inviteData) => {
    try {
      const response = await apiClient.post(`/api/events/${eventId}/invite/`, inviteData);
      return response.data;
    } catch (error) {
      logDev('Error inviting participant:', error);
      throw error;
    }
  },

  // Revoke an invitation
  revokeInvitation: async (invitationId) => {
    try {
      const response = await apiClient.delete(`/api/invitations/${invitationId}/revoke/`);
      return response.data;
    } catch (error) {
      logDev('Error revoking invitation:', error);
      throw error;
    }
  },

  // Delete an event by ID
  deleteEvent: async (eventId) => {
    try {
      const response = await apiClient.delete(`/api/events/${eventId}/delete/`);
      return response.data;
    } catch (error) {
      logDev('Error deleting event:', error);
      throw error;
    }
  },

  // Upload an event image directly with Axios (better handling of large base64 payload)
  uploadImage: async (base64Data, imageName) => {
    try {
      const response = await apiClient.post('/api/events/upload-image/', {
        image: base64Data,
        name: imageName,
      });
      return response.data;
    } catch (error) {
      logDev('Error uploading image:', error);
      throw error;
    }
  },

  // Create a new event
  createEvent: async (eventData) => {
    try {
      const response = await apiClient.post('/api/events/create/', eventData);
      return response.data;
    } catch (error) {
      logDev('Error creating event:', error);
      throw error;
    }
  },
};

export default eventService;
