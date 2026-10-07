/**
 * services/geoService.js — adresses (suggestions) et cartes
 */
import { apiClient } from './apiClient';

const geoService = {
  search: async (q, session) => (await apiClient.get('/api/geo/search/', { params: { q, session } })).data.results,
  place: async (id, session) => (await apiClient.get(`/api/geo/place/${encodeURIComponent(id)}/`, { params: { session } })).data,
};

export default geoService;
