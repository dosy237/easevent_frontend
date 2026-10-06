/**
 * utils/files.js — Easevent
 * Remise d'un fichier JSON à l'utilisateur (export RGPD).
 * Web : téléchargement direct. Mobile : feuille de partage native.
 */
import { Platform, Share } from 'react-native';

export async function downloadJson(filename, data) {
  const content = JSON.stringify(data, null, 2);
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ title: filename, message: content });
}
