/**
 * components/minisite/theme.js — du plan (spec) aux styles
 *   buildTheme(spec, width)  couleurs, polices, formes, espacements
 *   tone(theme, 'plain' | 'tinted' | 'inverse')  couleurs d'une section selon son fond
 * Les contrastes sont garantis par le serveur (minisite/colors.py).
 */
import { pairFor } from './fonts';
import { eventTime } from '../../utils/timezone';

export const RADIUS = {
  sharp: { card: 2, btn: 2, img: 0, chip: 2 },
  soft:  { card: 14, btn: 12, img: 12, chip: 10 },
  round: { card: 24, btn: 22, img: 22, chip: 18 },
  pill:  { card: 28, btn: 999, img: 28, chip: 999 },
};
export const DENSITY = {
  airy:     { pad: 48, gap: 18, title: 1.08 },
  balanced: { pad: 36, gap: 14, title: 1 },
  compact:  { pad: 26, gap: 10, title: 0.94 },
};

export function buildTheme(spec, width = 390) {
  const t = spec?.theme || {};
  const c = t.colors || {};
  const fonts = pairFor(t.fonts);
  const density = DENSITY[t.density] || DENSITY.balanced;
  const wide = width >= 700;
  return {
    c, fonts, density, wide, width,
    radius: RADIUS[t.radius] || RADIUS.soft,
    ornament: t.ornament || 'none',
    motion: t.motion || 'calm',
    // Taille des titres : base × densité × correction de la police (Bebas, Great Vibes…)
    size: (base) => Math.round(base * density.title * (fonts.scale || 1) * (wide ? 1.15 : 1)),
  };
}

export function tone(theme, name) {
  const { c } = theme;
  if (name === 'inverse') {
    return {
      bg: c.inverseBg, text: c.inverseText, muted: c.inverseMuted, card: 'rgba(255,255,255,0.08)',
      line: 'rgba(255,255,255,0.18)', btn: c.inverseText, onBtn: c.inverseBg, accent: c.inverseText,
    };
  }
  if (name === 'tinted') {
    return { bg: c.tint, text: c.text, muted: c.muted, card: c.surface, line: c.line, btn: c.primary, onBtn: c.onPrimary, accent: c.primary };
  }
  return { bg: c.bg, text: c.text, muted: c.muted, card: c.surface, line: c.line, btn: c.primary, onBtn: c.onPrimary, accent: c.primary };
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function when(iso, tz) {
  // Date dans le fuseau de l'événement ; « local » : l'heure chez le visiteur si elle diffère
  const t = eventTime(iso, tz);
  if (!t) return null;
  const p = t.parts;
  const date = new Date(p.year, p.month, p.day, p.hour, p.minute);
  return {
    date, day: p.day, dayName: DAYS[p.weekday], month: MONTHS[p.month], year: p.year, time: t.time,
    long: `${DAYS[p.weekday]} ${p.day === 1 ? '1er' : p.day} ${MONTHS[p.month]} ${p.year}`,
    short: `${p.day} ${MONTHS[p.month].slice(0, 3)}.`,
    zone: t.zone, local: t.local,
  };
}

export function priceText(event) {
  if (!event?.is_paid || !Number(event.price)) return 'Gratuit';
  const n = Number(event.price);
  return `${n.toFixed(n % 1 ? 2 : 0).replace('.', ',')} ${event.currency === 'XAF' ? 'FCFA' : '€'}`;
}

export function images(event) {
  return [event?.cover_image, ...(Array.isArray(event?.gallery) ? event.gallery : [])].filter(Boolean);
}
