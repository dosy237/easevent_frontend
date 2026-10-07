/**
 * utils/deviceContacts.js — contacts du téléphone (sélection des invités)
 * ════════════════════════════════════════════════════════════════
 * Mobile : expo-contacts, après accord de l'utilisateur. Rien n'est
 * envoyé au serveur sauf les contacts que l'utilisateur coche.
 * Navigateur : API « Contact Picker » quand elle existe (Chrome Android).
 * Retour : { status: 'ok' | 'denied' | 'unavailable', contacts: [...] }
 * contact = { id, name, phones: [{ number, label }], emails: [{ email, label }] }
 * ════════════════════════════════════════════════════════════════
 */
import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts';

const LABELS = { mobile: 'Mobile', home: 'Domicile', work: 'Travail', main: 'Principal', other: 'Autre' };
const label = (raw) => LABELS[(raw || '').toLowerCase()] || (raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : '');

export const webPickerAvailable = () =>
  Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.contacts?.select;

export async function loadDeviceContacts() {
  if (Platform.OS === 'web') {
    if (!webPickerAvailable()) return { status: 'unavailable', contacts: [] };
    try {
      const picked = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true });
      return {
        status: 'ok',
        preselected: true,
        contacts: picked.map((c, i) => ({
          id: `web-${i}`,
          name: (c.name && c.name[0]) || '',
          phones: (c.tel || []).map((number) => ({ number, label: '' })),
          emails: (c.email || []).map((email) => ({ email, label: '' })),
        })),
      };
    } catch {
      return { status: 'denied', contacts: [] };
    }
  }

  if (!(await Contacts.isAvailableAsync())) return { status: 'unavailable', contacts: [] };
  const { status, canAskAgain } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return { status: 'denied', canAskAgain, contacts: [] };

  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
    sort: Contacts.SortTypes.FirstName,
  });
  return {
    status: 'ok',
    contacts: data
      .map((c) => ({
        id: c.id,
        name: c.name || [c.firstName, c.lastName].filter(Boolean).join(' '),
        phones: (c.phoneNumbers || []).map((p) => ({ number: p.number || p.digits || '', label: label(p.label) })).filter((p) => p.number),
        emails: (c.emails || []).map((e) => ({ email: e.email || '', label: label(e.label) })).filter((e) => e.email),
      }))
      .filter((c) => c.phones.length || c.emails.length),
  };
}
