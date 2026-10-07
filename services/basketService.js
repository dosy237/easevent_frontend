/**
 * services/basketService.js — le panier d'un événement (cagnotte réinventée)
 */
import { apiClient } from './apiClient';

const basketService = {
  ofEvent: async (eventId) => (await apiClient.get(`/api/events/${eventId}/basket/`)).data,
  launch: async (eventId, data) => (await apiClient.post(`/api/events/${eventId}/basket/`, data)).data,
  close: async (basketId) => (await apiClient.post(`/api/baskets/${basketId}/close/`)).data,
  addItem: async (basketId, data) => (await apiClient.post(`/api/baskets/${basketId}/items/`, data)).data,
  addMoney: async (basketId, data) => (await apiClient.post(`/api/baskets/${basketId}/money/`, data)).data,
  contribution: async (id) => (await apiClient.get(`/api/baskets/contributions/${id}/`)).data,
  remove: async (id) => apiClient.delete(`/api/baskets/contributions/${id}/`),
  checkout: async (id) => (await apiClient.post(`/api/baskets/contributions/${id}/checkout/`)).data,
  mobileMoney: async (id) => (await apiClient.post(`/api/baskets/contributions/${id}/mobile-money/`, {})).data,
};

export default basketService;
