import { apiClient } from './apiClient';

/**
 * subscriptionService.js — abonnements (M20 / M21 / M22)
 */
const subscriptionService = {
  overview: async () => (await apiClient.get('/api/subscriptions/')).data,
  checkout: async (plan, interval) => (await apiClient.post('/api/subscriptions/checkout/', { plan, interval })).data,
  cancel: async () => (await apiClient.post('/api/subscriptions/cancel/')).data,
  resume: async () => (await apiClient.post('/api/subscriptions/resume/')).data,
  portal: async () => (await apiClient.post('/api/subscriptions/portal/')).data,
};

export default subscriptionService;
