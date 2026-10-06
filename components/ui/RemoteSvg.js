/**
 * components/ui/RemoteSvg.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Affiche une image SVG hébergée sur le backend (/static/app/...).
 * Toutes les images de l'application viennent du serveur : rien n'est
 * embarqué dans l'APK.
 *
 * Éco-conception : chaque fichier est téléchargé une seule fois par
 * session (cache mémoire + requêtes en cours partagées). La place est
 * réservée pendant le chargement pour éviter les sauts de mise en page.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { ASSETS_BASE } from '../../config';

const cache = new Map();     // url → xml
const pending = new Map();   // url → Promise<xml>

function loadSvg(url) {
  if (cache.has(url)) return Promise.resolve(cache.get(url));
  if (!pending.has(url)) {
    pending.set(url, fetch(url)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(String(res.status)))))
      .then((xml) => {
        // On n'affiche que du SVG : toute autre réponse est ignorée
        if (!xml.trim().startsWith('<svg')) throw new Error('not svg');
        cache.set(url, xml);
        return xml;
      })
      .finally(() => pending.delete(url)));
  }
  return pending.get(url);
}

export const assetUrl = (path) => `${ASSETS_BASE}/${path}`;

export default function RemoteSvg({ path, width, height, accessibilityLabel, style }) {
  const url = assetUrl(path);
  const [xml, setXml] = useState(cache.get(url) || null);

  useEffect(() => {
    let active = true;
    if (!xml) loadSvg(url).then((x) => active && setXml(x)).catch(() => {});
    return () => { active = false; };
  }, [url]);

  return (
    <View
      style={[{ width, height }, style]}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      {xml ? <SvgXml xml={xml} width={width} height={height} /> : null}
    </View>
  );
}
