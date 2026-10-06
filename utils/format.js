/**
 * utils/format.js — formats d'affichage partagés (français).
 */
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// "25.00" → "25,00 €"
export const formatPrice = (value, currency = 'EUR') => {
  const n = Number(value || 0);
  const symbol = currency === 'EUR' ? '€' : currency;
  return `${n.toFixed(currency === 'XAF' || currency === 'XOF' ? 0 : 2).replace('.', ',')} ${symbol}`;
};

const time = (d) => `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;

// "Mer 7 oct. 2026 · 09h00"
export const formatDateLong = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()} · ${time(d)}`;
};

// "Demain · 09h00", "Aujourd'hui · 18h00", "14 juin 2027 · 15h00"
export const formatDateRelative = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day - today) / 86400000);
  if (diff === 0) return `Aujourd'hui · ${time(d)}`;
  if (diff === 1) return `Demain · ${time(d)}`;
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()} · ${time(d)}`;
};

// "7 oct."
export const formatDayMonth = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MOIS[d.getMonth()]}`;
};
