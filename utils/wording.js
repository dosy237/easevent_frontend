/**
 * utils/wording.js — « Invitation » ou « Billet » selon l'événement
 * Même règle que le serveur (events/wording.py) : un événement privé ou une
 * célébration (mariage, anniversaire, soirée, gala) donne une invitation ;
 * un événement public ouvert (concert, conférence…) donne un billet.
 * Formes prêtes à l'emploi, accords compris : `${w.One} généré${w.e}`.
 */
const CELEBRATIONS = ['mariage', 'anniversaire', 'soiree', 'gala'];

export const INVITATION = {
  kind: 'invitation', one: 'invitation', One: 'Invitation', many: 'invitations', Many: 'Invitations',
  a: 'une invitation', the: "l'invitation", of: "de l'invitation", my: 'mon invitation', My: 'Mon invitation', your: 'votre invitation', e: 'e',
};
export const BILLET = {
  kind: 'billet', one: 'billet', One: 'Billet', many: 'billets', Many: 'Billets',
  a: 'un billet', the: 'le billet', of: 'du billet', my: 'mon billet', My: 'Mon billet', your: 'votre billet', e: '',
};

export function passWord(event) {
  if (!event) return BILLET;
  if (event.pass_word?.kind) return event.pass_word.kind === 'invitation' ? INVITATION : BILLET;
  if (event.visibility === 'private' || CELEBRATIONS.includes(event.event_type)) return INVITATION;
  return BILLET;
}
