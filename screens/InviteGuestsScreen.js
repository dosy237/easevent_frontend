/**
 * InviteGuestsScreen.js — Easevent (M12 « Inviter », M29 « Inviter par email »)
 * ════════════════════════════════════════════════════════════════
 * Paramètre : event (objet de l'événement, depuis M11).
 *
 * Trois modes, cumulables avant l'envoi :
 *  - Membres   : recherche par nom (≥ 2 caractères, 400 ms), sélection multiple.
 *  - Email     : chaque adresse est vérifiée → « Membre Easevent » ou
 *                « Pas encore inscrit » (recevra l'email M30).
 *  - Téléphone : indicatif + numéro, import CSV (phone, name), message
 *                personnalisé (100 caractères) et aperçu du SMS.
 * « Envoyer N invitations » → POST /api/events/:id/invite/ → M13.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';

import { C, TOUCH } from '../constants/theme';
import { BackButton } from '../components/ui/Buttons';
import invitationService from '../services/invitationService';
import { apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../utils/format';
import { COUNTRIES, formatPhone, isEmail, parseContactsCsv, splitEmails, toE164 } from '../utils/contacts';

const MODES = [
  { id: 'members', label: 'Membres', icon: 'people-outline' },
  { id: 'email', label: 'Email', icon: 'mail-outline' },
  { id: 'phone', label: 'Téléphone', icon: 'phone-portrait-outline' },
];
const PLAN_LABEL = { free: 'Plan Gratuit', standard: 'Plan Standard', pro: 'Plan Pro' };
const MESSAGE_MAX = 100;

async function readPickedFile(asset) {
  if (Platform.OS === 'web') {
    if (asset.file?.text) return asset.file.text();
    return (await fetch(asset.uri)).text();
  }
  return readAsStringAsync(asset.uri);
}

export default function InviteGuestsScreen({ navigation, route }) {
  const event = route.params?.event || {};
  const [mode, setMode] = useState(route.params?.mode || 'phone');
  const [usage, setUsage] = useState(null);

  // Sélections (conservées quand on change de mode)
  const [members, setMembers] = useState([]);   // [{ id, first_name, last_name, initials }]
  const [emails, setEmails] = useState([]);     // [{ email, has_account, name, initials, checking }]
  const [phones, setPhones] = useState([]);     // [{ phone, name }]
  const [message, setMessage] = useState('');

  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const total = members.length + emails.length + phones.length;

  useEffect(() => {
    if (!event.id) return;
    invitationService.participants(event.id).then((d) => setUsage(d.usage)).catch(() => {});
  }, [event.id]);

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'));
  const remaining = usage?.limit == null ? null : Math.max(0, usage.limit - usage.used);

  const send = async () => {
    if (!total) return;
    if (remaining != null && total > remaining) {
      showAlert('Limite du plan atteinte',
        `Votre ${PLAN_LABEL[usage.plan] || 'plan'} permet ${usage.limit} invités par événement. Il vous reste ${remaining} place(s).`,
        [{ text: 'Fermer', style: 'cancel' },
          { text: 'Voir les plans', onPress: () => navigation.navigate('TabProfile', { screen: 'Plans' }) }]);
      return;
    }
    setSending(true);
    try {
      const res = await invitationService.invite(event.id, {
        userIds: members.map((m) => m.id),
        emails: emails.map((e) => e.email),
        phoneNumbers: phones.map((p) => ({ phone: p.phone, name: p.name })),
        message: message.trim(),
      });
      if (res.usage) setUsage(res.usage);
      const failed = res.created.filter((c) => c.delivery_status === 'failed').length;
      const smsOff = res.created.filter((c) => c.delivery_status === 'not_configured').length;
      const lines = [res.detail];
      if (res.skipped.length) lines.push(`${res.skipped.length} contact(s) ignoré(s) : déjà invités ou invalides.`);
      if (failed) lines.push(`${failed} message(s) n'ont pas pu partir. Vous pourrez relancer depuis la liste des invités.`);
      if (smsOff) lines.push(`${smsOff} SMS en attente : l'envoi de SMS n'est pas encore activé sur le serveur. Les invitations sont créées.`);
      setMembers([]); setEmails([]); setPhones([]); setMessage('');
      showAlert(res.created.length ? 'Invitations envoyées' : 'Rien à envoyer', lines.join('\n\n'), [
        { text: 'Voir mes invités', onPress: () => navigation.replace('GuestList', { event, filter: 'all' }) },
      ]);
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === 'plan_limit') {
        showAlert('Limite du plan atteinte', data.detail, [
          { text: 'Fermer', style: 'cancel' },
          { text: 'Voir les plans', onPress: () => navigation.navigate('TabProfile', { screen: 'Plans' }) },
        ]);
      } else {
        showAlert('Envoi impossible', apiErrorMessage(err, "Les invitations n'ont pas pu être envoyées."));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <BackButton variant="square" onPress={goBack} />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} accessibilityRole="header">Inviter des participants</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {usage
                ? `${usage.used} / ${usage.limit ?? '∞'} invités · ${PLAN_LABEL[usage.plan] || ''}`
                : event.title}
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.tabs} accessibilityRole="tablist">
              {MODES.map((m) => {
                const active = mode === m.id;
                const count = { members: members.length, email: emails.length, phone: phones.length }[m.id];
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => setMode(m.id)}
                    style={[styles.tab, active && styles.tabActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${m.label}${count ? `, ${count} sélectionné${count > 1 ? 's' : ''}` : ''}`}
                  >
                    <Ionicons name={m.icon} size={15} color={active ? C.white : C.textSub} />
                    <Text style={[styles.tabTxt, active && styles.tabTxtActive]}>{m.label}</Text>
                    {count ? <View style={[styles.tabCount, active && styles.tabCountActive]}><Text style={[styles.tabCountTxt, active && { color: C.green }]}>{count}</Text></View> : null}
                  </Pressable>
                );
              })}
            </View>

            {mode === 'members' && (
              <MembersMode eventId={event.id} selected={members} onChange={setMembers} />
            )}
            {mode === 'email' && (
              <EmailMode list={emails} onChange={setEmails} event={event} />
            )}
            {mode === 'phone' && (
              <PhoneMode list={phones} onChange={setPhones} />
            )}

            <Text style={styles.label} nativeID="msgLabel">Message personnalisé</Text>
            <View>
              <TextInput
                style={styles.textarea}
                value={message}
                onChangeText={(t) => setMessage(t.replace(/\n/g, ' ').slice(0, MESSAGE_MAX))}
                placeholder="Ex. : On a hâte de partager ce moment avec vous !"
                placeholderTextColor={C.textFaint}
                multiline
                maxLength={MESSAGE_MAX}
                accessibilityLabel="Message personnalisé, 100 caractères maximum"
              />
              <Text style={styles.counter}>{message.length}/{MESSAGE_MAX}</Text>
            </View>

            {mode === 'phone' ? (
              <View style={styles.preview} accessible accessibilityLabel="Aperçu du SMS">
                <Text style={styles.previewLabel}>Aperçu du SMS</Text>
                <View style={styles.bubble}>
                  <Text style={styles.bubbleTxt}>
                    {user?.first_name || 'Vous'} vous invite à « {event.title} » le {event.start_date ? new Date(event.start_date).toLocaleDateString('fr-FR') : '—'}.
                    {message.trim() ? ` ${message.trim()}` : ''} <Text style={styles.bubbleLink}>easevent…/i/k7Qx…</Text>
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.info}>
                <Ionicons name="information-circle-outline" size={16} color={C.green} />
                <Text style={styles.infoTxt}>
                  Après acceptation, chaque invité retrouve son ticket à valider dans Mes tickets
                  (prix : {formatPrice(event.is_paid ? event.price : 0, event.currency)}).
                </Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={send}
              disabled={!total || sending}
              style={({ pressed }) => [styles.sendBtn, (!total || sending) && styles.sendBtnOff, pressed && { opacity: 0.9 }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !total || sending, busy: sending }}
            >
              {sending ? <ActivityIndicator color={C.white} /> : <Ionicons name="paper-plane-outline" size={18} color={C.white} />}
              <Text style={styles.sendTxt}>
                {sending ? 'Envoi en cours…' : total ? `Envoyer ${total} invitation${total > 1 ? 's' : ''}` : 'Ajoutez des invités'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Mode Membres
// ─────────────────────────────────────────────────────────────
function MembersMode({ eventId, selected, onChange }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef(null);
  const selectedIds = useMemo(() => new Set(selected.map((m) => m.id)), [selected]);

  const search = useCallback((text) => {
    setQ(text);
    clearTimeout(timer.current);
    if (text.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        setResults(await invitationService.searchUsers(text.trim(), eventId));
        setError('');
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }, 400);
  }, [eventId]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const toggle = (u) => onChange(selectedIds.has(u.id) ? selected.filter((m) => m.id !== u.id) : [...selected, u]);

  return (
    <View>
      <View style={styles.info}>
        <Ionicons name="notifications-outline" size={16} color={C.green} />
        <Text style={styles.infoTxt}>Les membres Easevent reçoivent l'invitation dans l'application et par email.</Text>
      </View>
      <Text style={styles.label}>Rechercher un membre</Text>
      <View style={styles.inputBox}>
        <Ionicons name="search-outline" size={18} color={C.textMut} />
        <TextInput
          style={styles.input}
          value={q}
          onChangeText={search}
          placeholder="Nom ou prénom (2 lettres minimum)"
          placeholderTextColor={C.textFaint}
          autoCorrect={false}
          accessibilityLabel="Rechercher un membre par nom"
        />
        {loading && <ActivityIndicator size="small" color={C.green} />}
      </View>

      {selected.length > 0 && (
        <View style={styles.chips}>
          {selected.map((m) => (
            <View key={m.id} style={styles.chip}>
              <Text style={styles.chipTxt}>{m.first_name} {m.last_name}</Text>
              <Pressable onPress={() => toggle(m)} style={styles.chipX} accessibilityRole="button" accessibilityLabel={`Retirer ${m.first_name} ${m.last_name}`}>
                <Ionicons name="close" size={14} color={C.greenDark} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {error ? <Text style={styles.errorTxt} accessibilityRole="alert">{error}</Text> : null}
      {q.trim().length >= 2 && !loading && results.length === 0 && !error ? (
        <Text style={styles.emptyTxt}>Aucun membre trouvé. Invitez cette personne par email ou SMS.</Text>
      ) : null}
      {results.map((u) => {
        const checked = selectedIds.has(u.id);
        return (
          <Pressable
            key={u.id}
            onPress={() => !u.already_invited && toggle(u)}
            disabled={u.already_invited}
            style={[styles.person, checked && styles.personOn, u.already_invited && { opacity: 0.6 }]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled: u.already_invited }}
            accessibilityLabel={`${u.first_name} ${u.last_name}${u.already_invited ? ', déjà invité' : ''}`}
          >
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{u.initials}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.personName}>{u.first_name} {u.last_name}</Text>
              <Text style={styles.personSub}>{u.already_invited ? 'Déjà invité' : 'Membre Easevent'}</Text>
            </View>
            <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? C.green : C.textMut} />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Mode Email (M29)
// ─────────────────────────────────────────────────────────────
function EmailMode({ list, onChange }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const add = async () => {
    const candidates = splitEmails(value).map((e) => e.toLowerCase());
    if (!candidates.length) return;
    const invalid = candidates.filter((e) => !isEmail(e));
    const fresh = candidates.filter((e) => isEmail(e) && !list.some((x) => x.email === e));
    setError(invalid.length ? `Adresse invalide : ${invalid.join(', ')}` : '');
    if (!fresh.length) { if (!invalid.length) setValue(''); return; }
    setValue(invalid.join(' '));
    const pending = fresh.map((email) => ({ email, checking: true }));
    let next = [...list, ...pending];
    onChange(next);
    try {
      const results = await invitationService.lookupEmails(fresh);
      const self = results.find((r) => r.is_self);
      next = next
        .map((item) => {
          const r = results.find((x) => x.email === item.email);
          return r ? { email: item.email, has_account: r.has_account, name: r.name, initials: r.initials } : item;
        })
        .filter((item) => !(self && item.email === self.email));
      if (self) setError('Vous ne pouvez pas vous inviter vous-même.');
      onChange(next);
    } catch {
      onChange(next.map((item) => (item.checking ? { ...item, checking: false } : item)));
    }
  };

  const remove = (email) => onChange(list.filter((x) => x.email !== email));

  return (
    <View>
      <Text style={styles.label} nativeID="emailLabel">Adresse email</Text>
      <View style={styles.row}>
        <View style={[styles.inputBox, { flex: 1 }, !!error && { borderColor: C.error }]}>
          <Ionicons name="mail-outline" size={18} color={C.green} />
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={(t) => { setValue(t); setError(''); }}
            placeholder="exemple@email.com"
            placeholderTextColor={C.textFaint}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            onSubmitEditing={add}
            returnKeyType="done"
            accessibilityLabel="Adresse email de l'invité"
          />
        </View>
        <Pressable onPress={add} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Ajouter l'adresse">
          <Ionicons name="add" size={22} color={C.white} />
        </Pressable>
      </View>
      {error ? <Text style={styles.errorTxt} accessibilityRole="alert">{error}</Text> : null}
      <Text style={styles.hint}>Vous pouvez coller plusieurs adresses séparées par des virgules.</Text>

      {list.length > 0 && <Text style={styles.sectionLabel}>À inviter ({list.length})</Text>}
      {list.map((item) => (
        <View key={item.email} style={[styles.person, item.has_account === false && styles.personNew]}>
          {item.has_account ? (
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{item.initials}</Text></View>
          ) : (
            <View style={[styles.avatar, { backgroundColor: C.orangeL }]}>
              <Ionicons name="person-add-outline" size={18} color="#B4492E" />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.personName} numberOfLines={1}>{item.has_account ? item.name : item.email}</Text>
            {item.has_account ? <Text style={styles.personSub} numberOfLines={1}>{item.email}</Text> : null}
            {item.checking ? (
              <Text style={styles.personSub}>Vérification…</Text>
            ) : item.has_account ? (
              <View style={styles.badgeGreen}><Text style={styles.badgeGreenTxt}>Membre Easevent · notification dans l'app</Text></View>
            ) : item.has_account === false ? (
              <>
                <View style={styles.badgeOrange}><Text style={styles.badgeOrangeTxt}>Pas encore inscrit</Text></View>
                <Text style={styles.personNote}>Recevra un email pour créer son compte et répondre.</Text>
              </>
            ) : null}
          </View>
          <Pressable onPress={() => remove(item.email)} style={styles.removeBtn} accessibilityRole="button" accessibilityLabel={`Retirer ${item.email}`}>
            <Ionicons name="close" size={18} color={C.textMut} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Mode Téléphone (M12)
// ─────────────────────────────────────────────────────────────
function PhoneMode({ list, onChange }) {
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [picker, setPicker] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);

  const add = () => {
    const phone = toE164(value, country.code);
    if (!phone) { setError('Numéro invalide. Vérifiez l’indicatif et le numéro.'); return; }
    if (!list.some((p) => p.phone === phone)) onChange([...list, { phone, name: '' }]);
    setValue('');
    setError('');
  };

  const importCsv = async () => {
    setImporting(true);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const text = await readPickedFile(res.assets[0]);
      const { contacts, invalid } = parseContactsCsv(text, country.code);
      const known = new Set(list.map((p) => p.phone));
      const fresh = contacts.filter((c) => !known.has(c.phone));
      onChange([...list, ...fresh]);
      showAlert('Import terminé',
        `${fresh.length} numéro${fresh.length > 1 ? 's' : ''} ajouté${fresh.length > 1 ? 's' : ''}.`
        + (invalid ? `\n${invalid} ligne${invalid > 1 ? 's' : ''} ignorée${invalid > 1 ? 's' : ''} (numéro invalide).` : '')
        + '\n\nFormat attendu : colonnes « phone » et « name » (facultatif).');
    } catch {
      showAlert('Import impossible', 'Le fichier n’a pas pu être lu. Utilisez un fichier CSV (colonnes phone, name).');
    } finally {
      setImporting(false);
    }
  };

  return (
    <View>
      <View style={styles.info}>
        <Ionicons name="information-circle-outline" size={16} color={C.green} />
        <Text style={styles.infoTxt}>Un SMS avec un lien personnel est envoyé. La personne n'a pas besoin de compte.</Text>
      </View>

      <Text style={styles.label}>Numéro de téléphone</Text>
      <View style={styles.row}>
        <Pressable onPress={() => setPicker(true)} style={styles.ccBtn} accessibilityRole="button"
          accessibilityLabel={`Indicatif pays : ${country.name} +${country.code}. Modifier`}>
          <Text style={styles.ccTxt}>+{country.code}</Text>
          <Ionicons name="chevron-down" size={14} color={C.text} />
        </Pressable>
        <View style={[styles.inputBox, { flex: 1 }, !!error && { borderColor: C.error }]}>
          <Ionicons name="phone-portrait-outline" size={18} color={C.green} />
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={(t) => { setValue(t); setError(''); }}
            placeholder="6 12 45 78 90"
            placeholderTextColor={C.textFaint}
            keyboardType="phone-pad"
            autoComplete="tel"
            onSubmitEditing={add}
            accessibilityLabel="Numéro de téléphone"
          />
        </View>
        <Pressable onPress={add} style={styles.addBtn} accessibilityRole="button" accessibilityLabel="Ajouter le numéro">
          <Ionicons name="add" size={22} color={C.white} />
        </Pressable>
      </View>
      {error ? <Text style={styles.errorTxt} accessibilityRole="alert">{error}</Text> : null}

      {list.length > 0 && (
        <View style={styles.chips}>
          {list.map((p) => (
            <View key={p.phone} style={styles.chip}>
              <Text style={styles.chipTxt}>{p.name ? `${p.name} · ` : ''}{formatPhone(p.phone)}</Text>
              <Pressable onPress={() => onChange(list.filter((x) => x.phone !== p.phone))} style={styles.chipX}
                accessibilityRole="button" accessibilityLabel={`Retirer ${formatPhone(p.phone)}`}>
                <Ionicons name="close" size={14} color={C.greenDark} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <Pressable onPress={importCsv} disabled={importing} style={styles.csvBtn} accessibilityRole="button"
        accessibilityHint="Fichier CSV avec les colonnes phone et name">
        {importing ? <ActivityIndicator size="small" color={C.green} /> : <Ionicons name="document-attach-outline" size={18} color={C.green} />}
        <Text style={styles.csvTxt}>Importer une liste CSV</Text>
      </Pressable>

      <Modal visible={picker} transparent animationType="slide" onRequestClose={() => setPicker(false)}>
        <Pressable style={styles.sheetShade} onPress={() => setPicker(false)} accessibilityLabel="Fermer" />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle} accessibilityRole="header">Indicatif pays</Text>
          <FlatList
            data={COUNTRIES}
            keyExtractor={(c) => c.code + c.name}
            renderItem={({ item }) => (
              <Pressable
                style={styles.countryRow}
                onPress={() => { setCountry(item); setPicker(false); }}
                accessibilityRole="button"
                accessibilityState={{ selected: item.code === country.code }}
              >
                <Text style={styles.countryName}>{item.name}</Text>
                <Text style={styles.countryCode}>+{item.code}</Text>
                {item.code === country.code && <Ionicons name="checkmark" size={18} color={C.green} />}
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerCenter: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  headerSub: { fontSize: 12, color: C.textMut, marginTop: 2 },
  scroll: { padding: 20, paddingBottom: 32, width: '100%', maxWidth: 560, alignSelf: 'center' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1, minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white,
  },
  tabActive: { backgroundColor: C.green, borderColor: C.green },
  tabTxt: { fontSize: 13, fontWeight: '600', color: C.textSub },
  tabTxtActive: { color: C.white },
  tabCount: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabCountActive: { backgroundColor: C.white },
  tabCountTxt: { fontSize: 10, fontWeight: '800', color: C.green },
  info: {
    flexDirection: 'row', gap: 8, backgroundColor: C.greenLight, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: C.greenSoft, marginBottom: 18,
  },
  infoTxt: { flex: 1, fontSize: 13, color: C.greenDark, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: C.textMut, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  inputBox: {
    minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14, backgroundColor: C.white, marginBottom: 6,
  },
  input: { flex: 1, minWidth: 0, fontSize: 15, color: C.text, paddingVertical: 12 },
  addBtn: { width: 52, height: 52, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  ccBtn: {
    height: 52, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.inputBg,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  ccTxt: { fontSize: 15, fontWeight: '600', color: C.text },
  hint: { fontSize: 12, color: C.textMut, marginBottom: 12 },
  errorTxt: { fontSize: 13, color: C.errorText, marginBottom: 8 },
  emptyTxt: { fontSize: 13, color: C.textSub, marginVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  chip: { minHeight: 34, flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 2, borderRadius: 17, backgroundColor: C.greenLight },
  chipTxt: { fontSize: 13, fontWeight: '600', color: C.greenDark },
  chipX: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  csvBtn: {
    minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.green, backgroundColor: '#F6FBF8', marginTop: 6, marginBottom: 18,
  },
  csvTxt: { fontSize: 14, fontWeight: '700', color: C.green },
  person: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14,
    borderWidth: 1, borderColor: C.border, marginBottom: 10, backgroundColor: C.white,
  },
  personOn: { borderColor: C.green, backgroundColor: '#F6FBF8' },
  personNew: { borderWidth: 1.5, borderColor: '#F2C9BB', backgroundColor: '#FFFBF9' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '800', color: C.green },
  personName: { fontSize: 14, fontWeight: '700', color: C.text },
  personSub: { fontSize: 12, color: C.textMut },
  personNote: { fontSize: 12, color: C.textSub, marginTop: 4, lineHeight: 16 },
  badgeGreen: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: C.greenLight, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeGreenTxt: { fontSize: 11, fontWeight: '700', color: C.greenDark },
  badgeOrange: { alignSelf: 'flex-start', marginTop: 4, backgroundColor: C.orangeL, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  badgeOrangeTxt: { fontSize: 11, fontWeight: '700', color: '#B4492E' },
  removeBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  textarea: {
    minHeight: 74, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.inputBg,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 22, fontSize: 14, lineHeight: 20, color: C.text, textAlignVertical: 'top',
  },
  counter: { position: 'absolute', right: 12, bottom: 8, fontSize: 11, color: C.textMut },
  preview: { backgroundColor: C.bg, borderRadius: 16, padding: 14, marginTop: 14 },
  previewLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: C.textMut, marginBottom: 8 },
  bubble: { backgroundColor: C.white, borderRadius: 14, borderBottomLeftRadius: 4, padding: 12 },
  bubbleTxt: { fontSize: 13, lineHeight: 19, color: C.text },
  bubbleLink: { color: C.green, fontWeight: '600' },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 24, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.white },
  sendBtn: {
    minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 16,
    backgroundColor: C.green, shadowColor: C.green, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3,
    width: '100%', maxWidth: 560, alignSelf: 'center',
  },
  sendBtnOff: { opacity: 0.5 },
  sendTxt: { fontSize: 16, fontWeight: '800', color: C.white },
  sheetShade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '70%', backgroundColor: C.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 16, paddingBottom: 24 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: C.text, paddingHorizontal: 20, marginBottom: 8 },
  countryRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  countryName: { flex: 1, fontSize: 15, color: C.text },
  countryCode: { fontSize: 15, fontWeight: '700', color: C.textSub },
});
