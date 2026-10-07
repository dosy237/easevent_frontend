/**
 * utils/rsvp.js — Questions RSVP de l'organisateur (M19)
 * ════════════════════════════════════════════════════════════════
 * withRsvp(send) : envoie l'acceptation ; si l'événement a des questions,
 * le serveur les renvoie (code rsvp_questions / rsvp_required), la fenêtre
 * <RsvpSheet /> les affiche, puis l'acceptation repart avec les réponses.
 * Si la personne ferme la fenêtre, l'erreur porte `cancelled: true` :
 * l'écran appelant n'affiche alors rien.
 * ════════════════════════════════════════════════════════════════
 */
let host = null;
export const registerRsvpHost = (ref) => { host = ref; };

const RSVP_CODES = ['rsvp_questions', 'rsvp_required'];

// Ouvre la fenêtre ; résout avec { qid: valeur } ou null si annulé
export function askRsvp(data) {
  if (!host) return Promise.resolve(null);
  return new Promise((resolve) => host.open({ ...data, resolve }));
}

export function isRsvpCancel(err) {
  return !!err?.cancelled;
}

export async function withRsvp(send) {
  try {
    return await send(undefined);
  } catch (err) {
    const data = err?.response?.data;
    if (!RSVP_CODES.includes(data?.code)) throw err;
    const answers = await askRsvp(data);
    if (answers === null) {
      const cancel = new Error('rsvp_cancelled');
      cancel.cancelled = true;
      throw cancel;
    }
    return send(answers);
  }
}
