/**
 * utils/contacts.js — numéros, emails et import CSV (M12 / M29)
 * Le serveur revalide tout : ces fonctions servent au retour immédiat.
 */

// Indicatifs proposés (France d'abord, puis Europe francophone et Afrique)
export const COUNTRIES = [
  { code: '33', name: 'France' },
  { code: '32', name: 'Belgique' },
  { code: '41', name: 'Suisse' },
  { code: '352', name: 'Luxembourg' },
  { code: '377', name: 'Monaco' },
  { code: '1', name: 'Canada / États-Unis' },
  { code: '221', name: 'Sénégal' },
  { code: '225', name: "Côte d'Ivoire" },
  { code: '237', name: 'Cameroun' },
  { code: '212', name: 'Maroc' },
  { code: '213', name: 'Algérie' },
  { code: '216', name: 'Tunisie' },
  { code: '223', name: 'Mali' },
  { code: '224', name: 'Guinée' },
  { code: '226', name: 'Burkina Faso' },
  { code: '227', name: 'Niger' },
  { code: '228', name: 'Togo' },
  { code: '229', name: 'Bénin' },
  { code: '241', name: 'Gabon' },
  { code: '242', name: 'Congo' },
  { code: '243', name: 'RD Congo' },
  { code: '261', name: 'Madagascar' },
  { code: '230', name: 'Maurice' },
  { code: '509', name: 'Haïti' },
  { code: '44', name: 'Royaume-Uni' },
  { code: '49', name: 'Allemagne' },
  { code: '34', name: 'Espagne' },
  { code: '39', name: 'Italie' },
  { code: '351', name: 'Portugal' },
];

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export const isEmail = (value) => EMAIL_RE.test(String(value || '').trim());

/** « 06 12 45 78 90 » + indicatif 33 → « +33612457890 » ; null si invalide. */
export function toE164(raw, countryCode = '33') {
  let v = String(raw || '').replace(/[\s.\-()]/g, '');
  if (!v) return null;
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  if (!v.startsWith('+')) v = `+${countryCode}${v.replace(/^0/, '')}`;
  return /^\+[1-9]\d{7,14}$/.test(v) ? v : null;
}

/** Affichage lisible : +33612457890 → « +33 6 12 45 78 90 ». */
export function formatPhone(e164) {
  const digits = String(e164 || '').replace(/^\+/, '');
  const country = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length)
    .find((c) => digits.startsWith(c.code));
  const cc = country ? country.code : digits.slice(0, 2);
  const rest = digits.slice(cc.length);
  const head = rest.length % 2 ? rest.slice(0, 1) : rest.slice(0, 2);
  const tail = rest.slice(head.length).match(/.{1,2}/g) || [];
  return `+${cc} ${[head, ...tail].join(' ')}`.trim();
}

/** Découpe une saisie collée (« a@x.fr, b@y.fr ; c@z.fr ») en adresses. */
export const splitEmails = (text) => String(text || '').split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);

/**
 * CSV de contacts : colonnes « phone » (obligatoire) et « name » (facultatif).
 * Séparateur « , » ou « ; ». Sans en-tête : 1re colonne = numéro, 2e = nom.
 * Retourne { contacts: [{ phone, name }], invalid: n }.
 */
export function parseContactsCsv(text, countryCode = '33') {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { contacts: [], invalid: 0 };
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const cells = (line) => line.split(sep).map((c) => c.trim().replace(/^"(.*)"$/, '$1').trim());

  let phoneIdx = 0;
  let nameIdx = 1;
  let start = 0;
  const header = cells(lines[0]).map((h) => h.toLowerCase());
  const findCol = (names) => header.findIndex((h) => names.includes(h));
  if (findCol(['phone', 'telephone', 'téléphone', 'tel', 'numero', 'numéro', 'mobile']) >= 0) {
    phoneIdx = findCol(['phone', 'telephone', 'téléphone', 'tel', 'numero', 'numéro', 'mobile']);
    nameIdx = findCol(['name', 'nom', 'prenom', 'prénom']);
    start = 1;
  }

  const contacts = [];
  const seen = new Set();
  let invalid = 0;
  lines.slice(start).forEach((line) => {
    const row = cells(line);
    const phone = toE164(row[phoneIdx], countryCode);
    if (!phone) { invalid += 1; return; }
    if (seen.has(phone)) return;
    seen.add(phone);
    contacts.push({ phone, name: nameIdx >= 0 ? (row[nameIdx] || '').slice(0, 80) : '' });
  });
  return { contacts, invalid };
}
