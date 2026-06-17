import { apiClient } from './apiClient';

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
      console.error('Error fetching invitations:', error);
      throw error;
    }
  },

  // Respond to an invitation (accept/decline)
  respondToInvitation: async (invitationId, status) => {
    try {
      const response = await apiClient.post(`/api/invitations/${invitationId}/repondre/`, { status });
      return response.data;
    } catch (error) {
      console.error('Error responding to invitation:', error);
      throw error;
    }
  },

  // Fetch events created by the current user
  fetchMyEvents: async () => {
    try {
      const response = await apiClient.get('/api/events/mes-evenements/');
      return response.data;
    } catch (error) {
      console.error('Error fetching my events:', error);
      throw error;
    }
  },

  fetchPublicEvents: async (params = {}) => {
    try {
      const response = await apiClient.get('/api/events/publics/', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching public events:', error);
      throw error;
    }
  },

  // Fetch single event detail
  fetchEventDetail: async (eventId) => {
    try {
      const response = await apiClient.get(`/api/events/${eventId}/detail/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching event detail:', error);
      throw error;
    }
  },

  // Fetch participants for a specific event
  fetchEventParticipants: async (eventId) => {
    try {
      const response = await apiClient.get(`/api/events/${eventId}/participants/`);
      return response.data;
    } catch (error) {
      console.error('Error fetching event participants:', error);
      throw error;
    }
  },

  // Publish or unpublish an event
  publishEvent: async (eventId, visibility) => {
    try {
      const response = await apiClient.post(`/api/events/${eventId}/publish/`, { visibility });
      return response.data;
    } catch (error) {
      console.error('Error publishing event:', error);
      throw error;
    }
  },

  // Invite a participant
  inviteParticipant: async (eventId, inviteData) => {
    try {
      const response = await apiClient.post(`/api/events/${eventId}/invite/`, inviteData);
      return response.data;
    } catch (error) {
      console.error('Error inviting participant:', error);
      throw error;
    }
  },

  // Revoke an invitation
  revokeInvitation: async (invitationId) => {
    try {
      const response = await apiClient.delete(`/api/invitations/${invitationId}/revoke/`);
      return response.data;
    } catch (error) {
      console.error('Error revoking invitation:', error);
      throw error;
    }
  },

  // Delete an event by ID
  deleteEvent: async (eventId) => {
    try {
      const response = await apiClient.delete(`/api/events/${eventId}/delete/`);
      return response.data;
    } catch (error) {
      console.error('Error deleting event:', error);
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
      console.error('Error uploading image:', error);
      throw error;
    }
  },

  // Create a new event
  createEvent: async (eventData) => {
    try {
      const response = await apiClient.post('/api/events/create/', eventData);
      return response.data;
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  },
};

export default eventService;
