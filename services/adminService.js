/**
 * services/adminService.js — tableau de bord de l'équipe (comptes administrateurs)
 * Le serveur refuse tout appel d'un compte non administrateur.
 */
import { apiClient } from './apiClient';

const adminService = {
  stats: async () => (await apiClient.get('/api/admin/stats/')).data,
  users: async (q = '', page = 1) => (await apiClient.get('/api/admin/users/', { params: { q, page } })).data,
  createUser: async (body) => (await apiClient.post('/api/admin/users/', body)).data,
  updateUser: async (id, body) => (await apiClient.patch(`/api/admin/users/${id}/`, body)).data,
  deleteUser: async (id) => apiClient.delete(`/api/admin/users/${id}/`),
  events: async (q = '', page = 1, status = '') => (await apiClient.get('/api/admin/events/', { params: { q, page, ...(status ? { status } : {}) } })).data,
  updateEvent: async (id, body) => (await apiClient.patch(`/api/admin/events/${id}/`, body)).data,
  deleteEvent: async (id) => (await apiClient.delete(`/api/admin/events/${id}/`)).data,
  announcements: async () => (await apiClient.get('/api/admin/announcements/')).data.results,
  createAnnouncement: async (body) => (await apiClient.post('/api/admin/announcements/', body)).data,
  updateAnnouncement: async (id, body) => (await apiClient.patch(`/api/admin/announcements/${id}/`, body)).data,
  deleteAnnouncement: async (id) => apiClient.delete(`/api/admin/announcements/${id}/`),
  // Pour tous : annonces en cours, en tête du fil
  live: async () => (await apiClient.get('/api/announcements/')).data.results,
};

export default adminService;
