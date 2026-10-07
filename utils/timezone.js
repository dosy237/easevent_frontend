/**
 * utils/timezone.js — l'heure de l'événement, et l'heure chez le visiteur
 * ════════════════════════════════════════════════════════════════
 * Un événement à Paris à 12h s'affiche « 12h00 (heure de Paris) », et pour
 * quelqu'un au Cameroun : « 11h00 chez vous ». Le fuseau de l'événement vient
 * du serveur (event.timezone) ; celui du téléphone, d'Intl.
 * Repli : si le téléphone ne sait pas convertir, l'heure locale seule.
 * ════════════════════════════════════════════════════════════════
 */
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const WEEK = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function deviceTz() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export const tzCity = (tz) => (tz || '').split('/').pop().replace(/_/g, ' ');

// { year, month (0-11), day, weekday (0-6), hour, minute } dans le fuseau demandé
export function partsIn(iso, tz) {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (tz) {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric',
        day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' });
      const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
      return { year: +p.year, month: +p.month - 1, day: +p.day, weekday: WEEK[p.weekday] ?? d.getDay(),
        hour: +p.hour % 24, minute: +p.minute, date: d };
    } catch { /* fuseau inconnu du téléphone : heure locale */ }
  }
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate(), weekday: d.getDay(), hour: d.getHours(), minute: d.getMinutes(), date: d };
}

export const hhmm = (p) => (p ? `${p.hour}h${String(p.minute).padStart(2, '0')}` : '');
export const longDate = (p) => (p ? `${DAYS[p.weekday]} ${p.day === 1 ? '1er' : p.day} ${MONTHS[p.month]} ${p.year}` : '');

/**
 * Heure d'un événement : { date, time, zone, local, differs }
 *   time  : « 12h00 » dans le fuseau de l'événement ; zone : « heure de Paris »
 *   local : « 11h00 chez vous » (ou « 11h00 le 15 juin chez vous » si le jour change), sinon null
 */
export function eventTime(iso, eventTz) {
  const ev = partsIn(iso, eventTz || deviceTz());
  if (!ev) return null;
  const me = partsIn(iso, deviceTz());
  const differs = !!eventTz && (me.hour !== ev.hour || me.minute !== ev.minute || me.day !== ev.day);
  return {
    parts: ev,
    date: longDate(ev),
    time: hhmm(ev),
    zone: eventTz ? `heure de ${tzCity(eventTz)}` : '',
    local: differs ? `${hhmm(me)}${me.day !== ev.day ? ` le ${me.day === 1 ? '1er' : me.day} ${MONTHS[me.month]}` : ''} chez vous` : null,
    differs,
  };
}
