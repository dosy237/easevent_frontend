/**
 * services/storage.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Stockage des jetons de session, identique sur mobile et sur le web.
 *
 * - iOS / Android : expo-secure-store (Keychain / Keystore chiffrés).
 * - Web : expo-secure-store n'existe pas. On utilise localStorage.
 *   Le jeton d'accès ne vit que 15 min et le refresh token tourne à
 *   chaque usage (liste noire côté serveur), ce qui limite l'impact
 *   d'un vol. L'application n'injecte jamais de HTML brut (pas de XSS).
 * ════════════════════════════════════════════════════════════════
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

const webStore = {
  getItemAsync: async (key) => {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItemAsync: async (key, value) => {
    try { window.localStorage.setItem(key, value); } catch { /* stockage indisponible */ }
  },
  deleteItemAsync: async (key) => {
    try { window.localStorage.removeItem(key); } catch { /* stockage indisponible */ }
  },
};

const storage = isWeb ? webStore : SecureStore;

export const KEYS = {
  ACCESS_TOKEN:  'easevent_access_token',
  REFRESH_TOKEN: 'easevent_refresh_token',
  USER:          'easevent_user',
  // Jeton d'un lien d'invitation (M31) à rattacher après connexion
  PENDING_INVITE: 'easevent_pending_invite',
  // Referrer du Play Store déjà lu (premier lancement)
  INSTALL_REFERRER_DONE: 'easevent_install_referrer_done',
};

export const getItem    = (key)        => storage.getItemAsync(key);
export const setItem    = (key, value) => storage.setItemAsync(key, value);
export const deleteItem = (key)        => storage.deleteItemAsync(key);

export const clearSession = async () => {
  await Promise.all([
    deleteItem(KEYS.ACCESS_TOKEN),
    deleteItem(KEYS.REFRESH_TOKEN),
    deleteItem(KEYS.USER),
  ]);
};
