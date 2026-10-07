/**
 * utils/plans.js — limites des plans (Gratuit / Standard / Pro)
 * Le serveur fait foi : il refuse avec un code (plan_event_limit, plan_limit,
 * plan_required) et un message clair ; ici on propose simplement les plans.
 */
import { showAlert } from './dialog';

const PLAN_CODES = ['plan_event_limit', 'plan_limit', 'plan_required'];

export const isPlanLimit = (err) => PLAN_CODES.includes(err?.response?.data?.code);

export const openPlans = (navigation, reason) =>
  navigation?.navigate('TabProfile', { screen: 'Plans', initial: false, params: reason ? { reason } : undefined });

export function planLimitAlert(navigation, err, title = 'Limite de votre plan') {
  const detail = err?.response?.data?.detail || 'Cette action est réservée aux plans Standard et Pro.';
  showAlert(title, detail, [
    { text: 'Plus tard', style: 'cancel' },
    { text: 'Voir les plans', onPress: () => openPlans(navigation, detail) },
  ]);
}

// « 2026-11-01 » → « 1er novembre »
export function frenchDay(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDate();
  return `${day === 1 ? '1er' : day} ${d.toLocaleDateString('fr-FR', { month: 'long' })}`;
}
