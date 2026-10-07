/**
 * services/realtime.js — connexion temps réel (WebSocket /ws/)
 * ════════════════════════════════════════════════════════════════
 * Une seule connexion pour toute l'application, ouverte quand
 * l'utilisateur est connecté et l'application au premier plan :
 *   message · typing · read · badge   (voir backend messaging/realtime.py)
 * - Authentification par le premier message (le jeton n'est jamais dans l'URL).
 * - Reconnexion automatique (1 s, 2 s, 4 s… 30 s max), ping toutes les 25 s.
 * - Fermée en arrière-plan (batterie, données) ; rouverte au retour.
 * - Si le serveur ne la propose pas, les écrans gardent l'interrogation
 *   périodique : isLive() indique s'ils peuvent l'espacer.
 * ════════════════════════════════════════════════════════════════
 */
import { AppState } from 'react-native';

import { API_BASE } from '../config';
import { apiClient } from './apiClient';
import { KEYS, getItem } from './storage';

const WS_URL = `${API_BASE.replace(/^http/, 'ws')}/ws/`;
const PING_EVERY = 25000;
const MAX_DELAY = 30000;

let socket = null;
let live = false;
let wanted = false;
let attempts = 0;
let retryTimer = null;
let pingTimer = null;
let appStateSub = null;
const listeners = new Set();
const statusListeners = new Set();

function setLive(value) {
  if (live === value) return;
  live = value;
  statusListeners.forEach((fn) => fn(value));
}

function emit(payload) {
  listeners.forEach((fn) => {
    try { fn(payload); } catch { /* un écran défaillant ne coupe pas les autres */ }
  });
}

function clearTimers() {
  clearTimeout(retryTimer);
  clearInterval(pingTimer);
  retryTimer = null;
  pingTimer = null;
}

function scheduleRetry() {
  if (!wanted || retryTimer) return;
  const delay = Math.min(MAX_DELAY, 1000 * 2 ** attempts);
  attempts += 1;
  retryTimer = setTimeout(() => { retryTimer = null; open(); }, delay);
}

async function open() {
  if (!wanted || socket || AppState.currentState === 'background') return;
  const token = await getItem(KEYS.ACCESS_TOKEN);
  if (!token || !wanted) return;
  let ws;
  try {
    ws = new WebSocket(WS_URL);
  } catch {
    scheduleRetry();
    return;
  }
  socket = ws;
  ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
  ws.onmessage = (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'ready') {
      attempts = 0;
      setLive(true);
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        try { ws.send(JSON.stringify({ type: 'ping' })); } catch { /* reconnexion gérée par onclose */ }
      }, PING_EVERY);
      emit({ type: 'connected' });      // les écrans rattrapent ce qu'ils ont manqué
      return;
    }
    if (data.type !== 'pong') emit(data);
  };
  ws.onclose = async (event) => {
    if (socket === ws) socket = null;
    clearInterval(pingTimer);
    setLive(false);
    if (event?.code === 4401) {
      // Jeton expiré : une requête API le renouvelle (intercepteur), puis on se reconnecte
      try { await apiClient.get('/api/notifications/unread-count/'); } catch { /* hors ligne */ }
    }
    scheduleRetry();
  };
  ws.onerror = () => { /* onclose suit toujours */ };
}

function close() {
  clearTimers();
  if (socket) {
    const ws = socket;
    socket = null;
    try { ws.close(); } catch { /* déjà fermée */ }
  }
  setLive(false);
}

export const realtime = {
  start() {
    wanted = true;
    attempts = 0;
    if (!appStateSub) {
      appStateSub = AppState.addEventListener('change', (next) => {
        if (next === 'active') { attempts = 0; open(); }
        else if (next === 'background') close();
      });
    }
    open();
  },
  stop() {
    wanted = false;
    close();
    appStateSub?.remove();
    appStateSub = null;
  },
  isLive: () => live,
  // Écoute des événements ; retourne la fonction de désinscription
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  onStatus(fn) {
    statusListeners.add(fn);
    return () => statusListeners.delete(fn);
  },
  send(payload) {
    if (socket && live) {
      try { socket.send(JSON.stringify(payload)); return true; } catch { return false; }
    }
    return false;
  },
};

export default realtime;
