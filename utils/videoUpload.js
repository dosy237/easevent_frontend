/**
 * utils/videoUpload.js — envoi d'une vidéo DIRECTEMENT à Cloudinary
 * Le serveur fournit une signature (dossier de l'organisateur, 1 h) ; le fichier
 * ne transite pas par notre serveur. onProgress(0..1) suit l'envoi.
 * Renvoie le public_id, que le serveur vérifie ensuite (durée réelle ≤ 45 s).
 */
import { Platform } from 'react-native';

import eventService from '../services/eventService';

export const VIDEO_MAX_SECONDS = 45;

export async function uploadVideo(asset, onProgress) {
  const sig = await eventService.videoSignature();
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = asset.file || await (await fetch(asset.uri)).blob();
    form.append('file', blob, asset.fileName || 'video.mp4');
  } else {
    form.append('file', { uri: asset.uri, type: asset.mimeType || 'video/mp4', name: asset.fileName || 'video.mp4' });
  }
  ['api_key', 'timestamp', 'signature', 'folder', 'public_id'].forEach((k) => form.append(k, String(sig[k])));
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', sig.upload_url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300 && res.public_id) resolve({ publicId: res.public_id, duration: res.duration });
        else reject(new Error(res.error?.message || 'Envoi refusé.'));
      } catch {
        reject(new Error('Réponse inattendue du service vidéo.'));
      }
    };
    xhr.onerror = () => reject(new Error('Connexion interrompue pendant l’envoi.'));
    xhr.send(form);
  });
}
