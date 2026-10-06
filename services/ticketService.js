import { apiClient } from './apiClient';

/**
 * ticketService.js — tickets (MVP §5) et paiements Stripe Connect.
 */
const ticketService = {
  // status : 'pending' | 'generated' | 'archived' | undefined (tous)
  fetchMine: async (status) => (await apiClient.get('/api/tickets/mine/', { params: status ? { status } : {} })).data,
  fetchCounts: async () => (await apiClient.get('/api/tickets/counts/')).data,
  fetchOne: async (id) => (await apiClient.get(`/api/tickets/${id}/`)).data,
  // Participer / Payer depuis le détail d'un événement (M24)
  take: async (eventId) => (await apiClient.post(`/api/events/${eventId}/tickets/`)).data,
  validate: async (id) => (await apiClient.post(`/api/tickets/${id}/validate/`)).data,
  cancel: async (id) => (await apiClient.post(`/api/tickets/${id}/cancel/`)).data,
  // Lien de téléchargement du PDF, signé et valable 5 minutes
  pdfLink: async (id) => (await apiClient.post(`/api/tickets/${id}/pdf-link/`)).data,
  // Paiement : URL de la page sécurisée Stripe Checkout
  checkout: async (id) => (await apiClient.post(`/api/tickets/${id}/checkout/`)).data,

  // Organisateur : Stripe Connect (recevoir l'argent des tickets sur son IBAN)
  connectStatus: async () => (await apiClient.get('/api/payments/connect/status/')).data,
  connectOnboard: async () => (await apiClient.post('/api/payments/connect/onboard/')).data,
  connectDashboard: async () => (await apiClient.post('/api/payments/connect/dashboard/')).data,
};

export default ticketService;
