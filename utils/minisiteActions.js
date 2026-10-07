/**
 * utils/minisiteActions.js — ce que font les boutons d'un mini-site
 * (carte, itinéraire, agenda, lien en ligne, photo plein écran, participation)
 */
import { Linking } from 'react-native';

import { openInMaps, openDirections } from '../components/maps/EventMap';
import { showAlert } from './dialog';

export function calendarUrl(event) {
  const fmt = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title || 'Événement Easevent',
    ...(event.start_date ? { dates: `${fmt(event.start_date)}/${fmt(event.end_date || event.start_date)}` } : {}),
    details: 'Événement Easevent',
    location: event.is_online ? 'En ligne' : (event.location_address || ''),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildActions({ event, onParticipate, onContact, onViewImage, ctaLabel, preview }) {
  const previewNotice = () => showAlert('Aperçu', 'Vos invités verront ici le bouton pour participer et obtenir leur ticket.');
  return {
    participate: preview ? previewNotice : onParticipate,
    map: () => openInMaps(event.map, event.location_address),
    directions: () => openDirections(event.map, event.location_address),
    calendar: () => Linking.openURL(calendarUrl(event)).catch(() => {}),
    online: () => (event.online_link ? Linking.openURL(event.online_link).catch(() => {}) : null),
    contact: onContact,
    viewImage: onViewImage,
    ctaLabel,
  };
}
