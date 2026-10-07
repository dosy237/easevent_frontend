/**
 * services/push.js — notifications push (Expo Notifications → FCM / APNs)
 * ════════════════════════════════════════════════════════════════
 * - register() : après la connexion, demande l'autorisation (Android 13+,
 *   iOS), crée le canal Android « default », récupère le jeton Expo et
 *   l'enregistre côté serveur.
 * - unregister() : à la déconnexion, le téléphone ne reçoit plus rien.
 * Sans projet EAS (extra.eas.projectId) ou sur le web, rien n'est fait.
 * ════════════════════════════════════════════════════════════════
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

import { apiClient } from './apiClient';
import { KEYS, getItem, setItem, deleteItem } from './storage';

const supported = Platform.OS !== 'web';

// Application ouverte : la notification s'affiche en bandeau (sauf la
// conversation déjà à l'écran, voir setActiveConversation).
let activeConversation = null;
export const setActiveConversation = (id) => { activeConversation = id || null; };

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification?.request?.content?.data || {};
      const hidden = data.type === 'message_received' && data.conversation_id && data.conversation_id === activeConversation;
      return { shouldShowBanner: !hidden, shouldShowList: !hidden, shouldPlaySound: !hidden, shouldSetBadge: true };
    },
  });
}

function projectId() {
  return Constants?.expoConfig?.extra?.eas?.projectId || Constants?.easConfig?.projectId || null;
}

export async function register() {
  if (!supported || !Device.isDevice) return null;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications Easevent',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#1B6B4A',
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;
    const id = projectId();
    if (!id) {
      console.warn('[push] extra.eas.projectId absent : lancez « eas init » pour activer les notifications push.');
      return null;
    }
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    await apiClient.post('/api/notifications/devices/', { token, platform: Platform.OS });
    await setItem(KEYS.PUSH_TOKEN, token);
    return token;
  } catch (err) {
    console.warn('[push] enregistrement impossible :', err?.message || err);
    return null;
  }
}

export async function unregister() {
  if (!supported) return;
  try {
    const token = await getItem(KEYS.PUSH_TOKEN);
    if (token) await apiClient.delete('/api/notifications/devices/', { data: { token } });
  } catch { /* hors ligne : le serveur oubliera le jeton au prochain envoi refusé */ }
  await deleteItem(KEYS.PUSH_TOKEN);
  try { await Notifications.setBadgeCountAsync(0); } catch { /* sans gravité */ }
}

// Notification touchée (application fermée ou en arrière-plan) → écran concerné
export function onTap(handler) {
  if (!supported) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handler(response?.notification?.request?.content?.data || {}, response?.notification?.request?.content);
  });
  // Lancement de l'application par un tap sur une notification
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) handler(response.notification.request.content.data || {}, response.notification.request.content);
  }).catch(() => {});
  return () => sub.remove();
}

export async function setBadge(count) {
  if (!supported) return;
  try { await Notifications.setBadgeCountAsync(Math.max(0, count || 0)); } catch { /* lanceur sans badge */ }
}
