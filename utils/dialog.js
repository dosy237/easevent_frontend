/**
 * utils/dialog.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * showAlert(title, message, buttons) — même signature que Alert.alert.
 *
 * Sur iOS / Android : Alert.alert natif (accessible, familier).
 * Sur le web : Alert.alert de react-native-web ne fait rien. Les
 * confirmations (déconnexion, suppression…) passent donc par
 * <DialogHost />, une fenêtre modale accessible montée dans App.js.
 * ════════════════════════════════════════════════════════════════
 */
import { Alert, Platform } from 'react-native';

let hostRef = null;
export const registerDialogHost = (ref) => { hostRef = ref; };

export function showAlert(title, message, buttons) {
  const list = buttons && buttons.length ? buttons : [{ text: 'OK' }];
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, list);
    return;
  }
  if (hostRef) {
    hostRef.open({ title, message, buttons: list });
    return;
  }
  // Repli minimal si l'hôte n'est pas encore monté
  if (list.length > 1) {
    const action = list.find((b) => b.style !== 'cancel');
    if (window.confirm([title, message].filter(Boolean).join('\n\n'))) action?.onPress?.();
  } else {
    window.alert([title, message].filter(Boolean).join('\n\n'));
    list[0]?.onPress?.();
  }
}
