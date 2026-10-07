/**
 * utils/likes.js — « J'aime » partagés par tous les écrans, à jour en direct
 * ════════════════════════════════════════════════════════════════
 * Le serveur diffuse { type: 'likes', event_id, count } à tous les connectés
 * (regroupé : au plus une fois par seconde et par événement). Chaque bouton
 * lit cet état commun : le fil, la page de l'événement et le mini-site
 * affichent le même chiffre sans recharger. Le toucher est optimiste
 * (affiché aussitôt) et annulé si le serveur refuse.
 * ════════════════════════════════════════════════════════════════
 */
import { useEffect, useState } from 'react';

import eventService from '../services/eventService';
import realtime from '../services/realtime';

const state = new Map();            // id → { count, liked }
const listeners = new Set();
const emit = (id) => listeners.forEach((fn) => fn(id));

realtime.subscribe((evt) => {
  if (evt?.type !== 'likes' || !evt.event_id) return;
  const prev = state.get(evt.event_id) || {};
  state.set(evt.event_id, { ...prev, count: evt.count });
  emit(evt.event_id);
});

// Les données reçues de l'API (fil, détail) alimentent l'état commun
export function seedLikes(events) {
  (events || []).forEach((e) => {
    if (e?.id && typeof e.likes_count === 'number') {
      const prev = state.get(e.id) || {};
      state.set(e.id, { count: e.likes_count, liked: e.liked ?? prev.liked ?? false });
    }
  });
}

export function useLikes(event) {
  const id = event?.id;
  const read = () => state.get(id) || { count: event?.likes_count || 0, liked: !!event?.liked };
  const [value, setValue] = useState(read);
  useEffect(() => {
    if (!id) return undefined;
    if (!state.has(id) && typeof event?.likes_count === 'number') seedLikes([event]);
    setValue(read());
    const fn = (changed) => { if (changed === id) setValue(read()); };
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, [id]);

  const toggle = async () => {
    if (!id) return;
    const before = read();
    const next = { liked: !before.liked, count: Math.max(0, before.count + (before.liked ? -1 : 1)) };
    state.set(id, next);
    emit(id);
    try {
      const res = await eventService.like(id, next.liked);
      state.set(id, { liked: res.liked, count: res.likes_count });
    } catch {
      state.set(id, before);                    // refus ou coupure : on revient en arrière
    }
    emit(id);
  };
  return [value, toggle];
}
