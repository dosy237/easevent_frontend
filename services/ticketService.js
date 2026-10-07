import { apiClient } from './apiClient';
import { withRsvp } from '../utils/rsvp';

/**
 * ticketService.js — tickets (MVP §5) et paiements Stripe Connect.
 */
const ticketService = {
  // status : 'pending' | 'generated' | 'archived' | undefined (tous)
  fetchMine: async (status) => (await apiClient.get('/api/tickets/mine/', { params: status ? { status } : {} })).data,
  fetchCounts: async () => (await apiClient.get('/api/tickets/counts/')).data,
  fetchOne: async (id) => (await apiClient.get(`/api/tickets/${id}/`)).data,
  // Participer / Payer depuis le détail d'un événement (M24)
  // Questions RSVP de l'organisateur affichées avant, s'il y en a (M19)
  take: async (eventId) => withRsvp(async (answers) => (await apiClient.post(`/api/events/${eventId}/tickets/`,
    answers === undefined ? {} : { rsvp_answers: answers })).data),
  validate: async (id) => (await apiClient.post(`/api/tickets/${id}/validate/`)).data,
  cancel: async (id) => (await apiClient.post(`/api/tickets/${id}/cancel/`)).data,
  // Lien de téléchargement du PDF, signé et valable 5 minutes
  pdfLink: async (id) => (await apiClient.post(`/api/tickets/${id}/pdf-link/`)).data,
  // Paiement : URL de la page sécurisée Stripe Checkout
  checkout: async (id) => (await apiClient.post(`/api/tickets/${id}/checkout/`)).data,
  // Orange Money / MTN MoMo (Notch Pay) : { url, reference, amount, currency: 'XAF' }
  mobileMoney: async (id) => (await apiClient.post(`/api/tickets/${id}/mobile-money/`, {})).data,
  paymentMethods: async () => (await apiClient.get('/api/payments/methods/')).data,
  // Billet offert à un proche : { recipient: { user_id } | { name, email } | { name, phone }, message }
  createGift: async (eventId, body) => (await apiClient.post(`/api/events/${eventId}/gifts/`, body)).data,
  gift: async (id) => (await apiClient.get(`/api/gifts/${id}/`)).data,
  giftCheckout: async (id) => (await apiClient.post(`/api/gifts/${id}/checkout/`)).data,
  giftMobileMoney: async (id) => (await apiClient.post(`/api/gifts/${id}/mobile-money/`, {})).data,
  cancelGift: async (id) => (await apiClient.post(`/api/gifts/${id}/cancel/`)).data,

  // Organisateur : Stripe Connect (recevoir l'argent des tickets sur son IBAN)
  connectStatus: async () => (await apiClient.get('/api/payments/connect/status/')).data,
  connectOnboard: async () => (await apiClient.post('/api/payments/connect/onboard/')).data,
  connectDashboard: async () => (await apiClient.post('/api/payments/connect/dashboard/')).data,
};

export default ticketService;
