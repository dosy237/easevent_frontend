// URL du backend. Priorité : variable d'environnement Expo, sinon réseau local.
// build.sh peut réécrire ce fichier au moment du déploiement.
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE ||
  'http://192.168.1.101:8003';
