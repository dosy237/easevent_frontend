/**
 * utils/region.js — le pays du téléphone (« CM », « FR »…)
 * D'après la région de la langue du téléphone (fr-CM), sinon d'après son fuseau horaire.
 * Sert à la devise par défaut et à l'indicatif téléphonique par défaut.
 */
import { deviceTz } from './timezone';

// Fuseau → pays, quand la langue du téléphone ne précise pas la région (« fr » seul)
const BY_ZONE = {
  'Africa/Douala': 'CM', 'Africa/Libreville': 'GA', 'Africa/Brazzaville': 'CG', 'Africa/Ndjamena': 'TD',
  'Africa/Bangui': 'CF', 'Africa/Malabo': 'GQ', 'Africa/Dakar': 'SN', 'Africa/Abidjan': 'CI',
  'Africa/Porto-Novo': 'BJ', 'Africa/Ouagadougou': 'BF', 'Africa/Bamako': 'ML', 'Africa/Niamey': 'NE',
  'Africa/Lome': 'TG', 'Europe/London': 'GB', 'Europe/Zurich': 'CH', 'Africa/Johannesburg': 'ZA',
  'Asia/Kolkata': 'IN', 'Asia/Shanghai': 'CN', 'Asia/Tokyo': 'JP', 'America/Sao_Paulo': 'BR',
  'America/Mexico_City': 'MX', 'Europe/Istanbul': 'TR', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK', 'Europe/Warsaw': 'PL', 'Europe/Paris': 'FR', 'Europe/Brussels': 'BE',
};

export function deviceRegion() {
  let region = null;
  try { region = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).region; } catch { /* Intl.Locale absent */ }
  if (!region) {
    const tz = deviceTz();
    region = BY_ZONE[tz] || (tz.startsWith('America/') && !tz.includes('Sao_Paulo') ? 'US' : null);
  }
  return region || null;
}

// Indicatif téléphonique du pays du téléphone (France par défaut)
const DIAL = {
  FR: '33', BE: '32', CH: '41', LU: '352', MC: '377', US: '1', CA: '1', SN: '221', CI: '225', CM: '237', MA: '212',
  DZ: '213', TN: '216', ML: '223', GN: '224', BF: '226', NE: '227', TG: '228', BJ: '229', GA: '241', CG: '242',
  CD: '243', MG: '261', MU: '230', HT: '509', GB: '44', DE: '49', ES: '34', IT: '39', PT: '351',
};

export function deviceDialCode() {
  return DIAL[deviceRegion()] || '33';
}
