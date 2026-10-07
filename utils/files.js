/**
 * utils/files.js — Easevent
 * Remise d'un fichier JSON à l'utilisateur (export RGPD).
 * Web : téléchargement direct. Mobile : feuille de partage native.
 */
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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
  // Mobile : vrai fichier .json (un export volumineux ne tient pas dans un message de partage)
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Mes données Easevent', UTI: 'public.json' });
  }
}
