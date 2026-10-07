/**
 * components/minisite/fonts.js — polices des mini-sites, chargées à la demande
 * Seuls les fichiers utilisés sont référencés (APK plus léger) et une police
 * n'est chargée qu'à l'ouverture d'un mini-site qui l'utilise.
 */
import { useEffect, useState } from 'react';
import * as Font from 'expo-font';

const FILES = {
  'ms-playfair-700': () => require('@expo-google-fonts/playfair-display/700Bold/PlayfairDisplay_700Bold.ttf'),
  'ms-inter-400': () => require('@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf'),
  'ms-inter-600': () => require('@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf'),
  'ms-cormorant-600': () => require('@expo-google-fonts/cormorant-garamond/600SemiBold/CormorantGaramond_600SemiBold.ttf'),
  'ms-lora-400': () => require('@expo-google-fonts/lora/400Regular/Lora_400Regular.ttf'),
  'ms-lora-600': () => require('@expo-google-fonts/lora/600SemiBold/Lora_600SemiBold.ttf'),
  'ms-lora-700': () => require('@expo-google-fonts/lora/700Bold/Lora_700Bold.ttf'),
  'ms-dmserif-400': () => require('@expo-google-fonts/dm-serif-display/400Regular/DMSerifDisplay_400Regular.ttf'),
  'ms-poppins-400': () => require('@expo-google-fonts/poppins/400Regular/Poppins_400Regular.ttf'),
  'ms-poppins-600': () => require('@expo-google-fonts/poppins/600SemiBold/Poppins_600SemiBold.ttf'),
  'ms-poppins-700': () => require('@expo-google-fonts/poppins/700Bold/Poppins_700Bold.ttf'),
  'ms-fraunces-700': () => require('@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.ttf'),
  'ms-nunito-400': () => require('@expo-google-fonts/nunito/400Regular/Nunito_400Regular.ttf'),
  'ms-nunito-700': () => require('@expo-google-fonts/nunito/700Bold/Nunito_700Bold.ttf'),
  'ms-bebas-400': () => require('@expo-google-fonts/bebas-neue/400Regular/BebasNeue_400Regular.ttf'),
  'ms-syne-700': () => require('@expo-google-fonts/syne/700Bold/Syne_700Bold.ttf'),
  'ms-syne-800': () => require('@expo-google-fonts/syne/800ExtraBold/Syne_800ExtraBold.ttf'),
  'ms-spacegrotesk-700': () => require('@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf'),
  'ms-greatvibes-400': () => require('@expo-google-fonts/great-vibes/400Regular/GreatVibes_400Regular.ttf'),
};

// display : titres ; body / bold : textes ; scale : correction de taille (Bebas, Great Vibes)
export const FONT_PAIRS = {
  'playfair-inter':     { display: 'ms-playfair-700', body: 'ms-inter-400', bold: 'ms-inter-600' },
  'cormorant-lora':     { display: 'ms-cormorant-600', body: 'ms-lora-400', bold: 'ms-lora-600', scale: 1.12 },
  'dmserif-poppins':    { display: 'ms-dmserif-400', body: 'ms-poppins-400', bold: 'ms-poppins-600' },
  'fraunces-nunito':    { display: 'ms-fraunces-700', body: 'ms-nunito-400', bold: 'ms-nunito-700' },
  'bebas-inter':        { display: 'ms-bebas-400', body: 'ms-inter-400', bold: 'ms-inter-600', scale: 1.22, upper: true },
  'syne-inter':         { display: 'ms-syne-700', body: 'ms-inter-400', bold: 'ms-inter-600' },
  'spacegrotesk-inter': { display: 'ms-spacegrotesk-700', body: 'ms-inter-400', bold: 'ms-inter-600' },
  'greatvibes-lora':    { display: 'ms-greatvibes-400', body: 'ms-lora-400', bold: 'ms-lora-600', scale: 1.3 },
  'poppins-nunito':     { display: 'ms-poppins-700', body: 'ms-nunito-400', bold: 'ms-nunito-700' },
  'lora-inter':         { display: 'ms-lora-700', body: 'ms-inter-400', bold: 'ms-inter-600' },
  'dmserif-inter':      { display: 'ms-dmserif-400', body: 'ms-inter-400', bold: 'ms-inter-600' },
  'syne-nunito':        { display: 'ms-syne-800', body: 'ms-nunito-400', bold: 'ms-nunito-700' },
};

const loaded = new Set();

export function pairFor(id) {
  return FONT_PAIRS[id] || FONT_PAIRS['playfair-inter'];
}

async function load(names) {
  const missing = names.filter((n) => !loaded.has(n) && FILES[n]);
  if (!missing.length) return;
  await Font.loadAsync(Object.fromEntries(missing.map((n) => [n, FILES[n]()])));
  missing.forEach((n) => loaded.add(n));
}

// Charge les polices d'une ou plusieurs paires ; renvoie true quand elles sont prêtes
export function useMiniSiteFonts(ids) {
  const names = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean)
    .flatMap((id) => { const p = pairFor(id); return [p.display, p.body, p.bold]; }))];
  const key = names.join('|');
  const [ready, setReady] = useState(() => names.every((n) => loaded.has(n)));
  useEffect(() => {
    let alive = true;
    if (names.every((n) => loaded.has(n))) { setReady(true); return undefined; }
    setReady(false);
    load(names).catch(() => {}).finally(() => { if (alive) setReady(true); });   // repli : polices système
    return () => { alive = false; };
  }, [key]);
  return ready;
}
