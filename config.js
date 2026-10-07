// URL du backend.
// 1. EXPO_PUBLIC_API_URL (fixée par profil dans eas.json, ou par build.sh pour le web)
// 2. sinon : serveur de production en HTTPS pour un APK / une app publiée,
//    serveur du réseau local en développement (npx expo start).
// Android refuse le HTTP non chiffré dans une version publiée : toujours https:// en production.
const PRODUCTION_API = 'https://easevent.nitypulse.com';
const DEV_API = 'http://192.168.1.101:8003';

export const API_BASE = (
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE ||
  (typeof __DEV__ !== 'undefined' && __DEV__ ? DEV_API : PRODUCTION_API)
).replace(/\/$/, '');

// Images de l'application (logo, illustrations) : servies par le backend.
export const ASSETS_BASE = `${API_BASE}/static/app`;
