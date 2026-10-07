/**
 * utils/log.js — journal de développement.
 * En production (APK), rien n'est écrit dans la console : les erreurs
 * attendues (réseau, 4xx) sont déjà affichées à l'utilisateur par l'écran.
 */
export const logDev = (...args) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(...args);
};
