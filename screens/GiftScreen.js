/**
 * screens/GiftScreen.js — « Payer pour un proche » : offrir sa place à quelqu'un
 * ════════════════════════════════════════════════════════════════
 * 1. Pour qui ? un ami, un membre trouvé par la recherche, ou une autre personne
 *    (prénom + email ou téléphone) qui n'est pas encore sur Easevent.
 * 2. Un mot (facultatif).
 * 3. Paiement : carte ou Orange Money / MTN MoMo. Gratuit : rien à payer.
 * Le billet est créé AU NOM du proche : il le retrouve dans ses Invitations, avec
 * votre message dans sa messagerie. Pas encore inscrit : il reçoit un email ou un
 * SMS, et le billet l'attend à son inscription.
 * params : { event }
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { BackButton, PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import Price from '../components/ui/Price';
import { C, TOUCH } from '../constants/theme';
import friendService from '../services/friendService';
import invitationService from '../services/invitationService';
import ticketService from '../services/ticketService';
import { apiErrorMessage } from '../services/authService';
import { deviceCurrency } from '../utils/currency';
import { formatPrice } from '../utils/format';
import { eventTime } from '../utils/timezone';
import { passWord } from '../utils/wording';

const MODES = [['friends', 'Mes amis'], ['search', 'Rechercher'], ['other', 'Autre personne']];
const POLL_EVERY = 2500;
const POLL_FOR = 120000;

export default function GiftScreen({ route, navigation }) {
  const event = route?.params?.event || {};
  const pw = passWord(event);
  const isPaid = !!event.is_paid && Number(event.price) > 0;
  const price = isPaid ? formatPrice(event.price, event.currency) : 'Gratuit';
  const when = eventTime(event.start_date, event.timezone);

  const [step, setStep] = useState('who');           // who → confirm → waiting → done
  const [mode, setMode] = useState('friends');
  const [friends, setFriends] = useState(null);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(null);         // { user_id, name } ou { name, email | phone }
  const [other, setOther] = useState({ name: '', contact: '', by: 'email' });
  const [message, setMessage] = useState('');
  const [method, setMethod] = useState('card');
  const [mobileOk, setMobileOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [gift, setGift] = useState(null);
  const alive = useRef(true);

  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    friendService.list().then((d) => setFriends(d.friends || [])).catch(() => setFriends([]));
    ticketService.paymentMethods().then((m) => {
      setMobileOk(!!m.mobile_money);
      if (m.mobile_money && ['XAF', 'XOF'].includes(deviceCurrency())) setMethod('mobile');
    }).catch(() => {});
  }, []);

  // Recherche de membres (≥ 2 caractères, après une courte pause de frappe)
  useEffect(() => {
    if (mode !== 'search' || query.trim().length < 2) { setFound([]); return undefined; }
    setSearching(true);
    const t = setTimeout(() => {
      invitationService.searchUsers(query.trim()).then(setFound).catch(() => setFound([])).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, mode]);

  const fcfa = ['EUR', 'XAF', 'XOF'].includes(event.currency || 'EUR')
    ? Math.ceil((Number(event.price || 0) * ((event.currency || 'EUR') === 'EUR' ? 655.957 : 1)) / 5) * 5 : null;
  const useMobile = isPaid && mobileOk && fcfa !== null && method === 'mobile';
  const fcfaTxt = fcfa !== null ? `${String(fcfa).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA` : '';

  const otherValid = other.name.trim().length >= 2 && (other.by === 'email'
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(other.contact.trim())
    : other.contact.replace(/[^\d]/g, '').length >= 8);
  const recipient = mode === 'other'
    ? (otherValid ? { name: other.name.trim(), [other.by]: other.contact.trim() } : null)
    : picked;
  const recipientName = recipient?.name || '';

  const shownFriends = useMemo(() => (friends || []).filter((f) => !query.trim() || f.user.name.toLowerCase().includes(query.trim().toLowerCase())), [friends, query]);

  const waitForPayment = async (id) => {
    setStep('waiting');
    const until = Date.now() + POLL_FOR;
    while (alive.current && Date.now() < until) {
      try {
        const g = await ticketService.gift(id);
        if (['delivered', 'paid'].includes(g.status)) { setGift(g); setStep('done'); return; }
        if (g.payment_status === 'failed') { setError('Paiement non abouti. Vous pouvez réessayer.'); setStep('confirm'); return; }
      } catch { /* coupure passagère */ }
      await new Promise((r) => setTimeout(r, POLL_EVERY));
    }
    if (alive.current) { setError('Le paiement n’est pas encore confirmé. Vous serez notifié dès qu’il le sera.'); setStep('confirm'); }
  };

  const offer = async () => {
    setError('');
    setBusy(true);
    try {
      const body = { recipient: recipient.user_id ? { user_id: recipient.user_id } : recipient, message: message.trim() };
      const g = await ticketService.createGift(event.id, body);
      setGift(g);
      if (['delivered', 'paid'].includes(g.status)) { setStep('done'); return; }
      const url = useMobile ? (await ticketService.giftMobileMoney(g.id)).url : (await ticketService.giftCheckout(g.id)).checkout_url;
      await WebBrowser.openAuthSessionAsync(url, 'easevent://invitations');
      await waitForPayment(g.id);
    } catch (err) {
      setError(apiErrorMessage(err, 'Le cadeau n’a pas pu être préparé. Réessayez.'));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const Person = ({ id, name, initials, sub }) => {
    const on = picked?.user_id === id;
    return (
      <Pressable onPress={() => setPicked(on ? null : { user_id: id, name })} style={[styles.person, on && styles.personOn]}
        accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={name}>
        <View style={styles.avatar}><Text style={styles.avatarTxt}>{initials}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.personName} numberOfLines={1}>{name}</Text>
          {sub ? <Text style={styles.personSub}>{sub}</Text> : null}
        </View>
        <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? C.green : C.textMut} />
      </Pressable>
    );
  };

  // ── Terminé ──
  if (step === 'done' && gift) {
    const delivered = gift.status === 'delivered';
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <View style={styles.doneIcon}><Ionicons name="gift" size={44} color={C.green} /></View>
        <Text style={styles.doneTitle} accessibilityRole="header">
          {delivered ? `${pw.One} offert${pw.e} à ${gift.recipient.name}` : `${pw.One} réservé${pw.e} pour ${gift.recipient.name}`}
        </Text>
        <Text style={styles.doneSub}>
          {delivered
            ? `${gift.recipient.name} ${pw.the === "l'invitation" ? 'la' : 'le'} retrouve dans ses invitations, avec votre message dans sa messagerie.`
            : `${gift.recipient.name} reçoit un ${gift.recipient.contact?.includes('@') ? 'email' : 'SMS'} : ${pw.the} lui sera remis${pw.e} dès son inscription sur Easevent.`}
        </Text>
        <View style={{ alignSelf: 'stretch', gap: 10, marginTop: 28 }}>
          <PrimaryButton label="Retour à l'événement" onPress={() => navigation.goBack()} />
          <SecondaryButton label="Offrir à quelqu'un d'autre" onPress={() => { setGift(null); setPicked(null); setMessage(''); setStep('who'); }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton variant="square" onPress={() => (step === 'confirm' ? setStep('who') : navigation.goBack())} />
        <Text style={styles.title} accessibilityRole="header">{`Offrir ${pw.a}`}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.eventCard} accessible accessibilityLabel={`${event.title}, ${when?.date || ''}, ${price}`}>
        <Ionicons name="gift-outline" size={22} color={C.green} />
        <View style={{ flex: 1 }}>
          <Text style={styles.eventTitle} numberOfLines={2}>{event.title}</Text>
          <Text style={styles.eventSub}>{`${when ? `${when.date.charAt(0).toUpperCase()}${when.date.slice(1)} · ${when.time}` : ''}`}</Text>
        </View>
        <Text style={styles.eventPrice}>{price}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {step === 'who' ? (
          <View style={{ flex: 1 }}>
            <Text style={styles.question}>Pour qui ?</Text>
            <View style={styles.tabs} accessibilityRole="tablist">
              {MODES.map(([id, label]) => (
                <Pressable key={id} onPress={() => { setMode(id); setQuery(''); }} style={[styles.tab, mode === id && styles.tabOn]}
                  accessibilityRole="tab" accessibilityState={{ selected: mode === id }} aria-selected={mode === id}>
                  <Text style={[styles.tabTxt, mode === id && styles.tabTxtOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>

            {mode === 'other' ? (
              <ScrollView contentContainerStyle={styles.panel} keyboardShouldPersistTaps="handled">
                <Text style={styles.hint}>Pas encore sur Easevent ? Votre proche reçoit un email ou un SMS, et son {pw.one} l’attend à son inscription.</Text>
                <Text style={styles.label}>Prénom</Text>
                <TextInput value={other.name} onChangeText={(v) => setOther({ ...other, name: v.slice(0, 80) })} style={styles.input}
                  placeholder="Ex : Mireille" placeholderTextColor={C.textMut} accessibilityLabel="Prénom du proche" />
                <View style={[styles.tabs, { marginHorizontal: 0, marginTop: 14 }]}>
                  {[['email', 'Email'], ['phone', 'Téléphone']].map(([id, label]) => (
                    <Pressable key={id} onPress={() => setOther({ ...other, by: id, contact: '' })} style={[styles.tab, other.by === id && styles.tabOn]}
                      accessibilityRole="radio" accessibilityState={{ checked: other.by === id }} aria-checked={other.by === id}>
                      <Text style={[styles.tabTxt, other.by === id && styles.tabTxtOn]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput value={other.contact} onChangeText={(v) => setOther({ ...other, contact: v })} style={[styles.input, { marginTop: 10 }]}
                  placeholder={other.by === 'email' ? 'adresse@exemple.com' : '+237 6 90 00 00 00'} placeholderTextColor={C.textMut}
                  keyboardType={other.by === 'email' ? 'email-address' : 'phone-pad'} autoCapitalize="none"
                  accessibilityLabel={other.by === 'email' ? 'Email du proche' : 'Téléphone du proche'} />
              </ScrollView>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={styles.search}>
                  <Ionicons name="search-outline" size={18} color={C.textMut} />
                  <TextInput value={query} onChangeText={setQuery} style={styles.searchInput} placeholderTextColor={C.textMut}
                    placeholder={mode === 'friends' ? 'Filtrer mes amis' : 'Nom d’un membre Easevent'}
                    accessibilityLabel={mode === 'friends' ? 'Filtrer mes amis' : 'Rechercher un membre'} />
                  {searching ? <ActivityIndicator color={C.green} /> : null}
                </View>
                {mode === 'friends' && friends === null ? <ActivityIndicator color={C.green} style={{ marginTop: 24 }} /> : (
                  <FlatList
                    data={mode === 'friends' ? shownFriends : found}
                    keyExtractor={(x) => (x.user ? x.user.id : x.id)}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}
                    keyboardShouldPersistTaps="handled"
                    ListEmptyComponent={(
                      <Text style={styles.empty}>
                        {mode === 'friends'
                          ? (friends?.length ? 'Aucun ami ne correspond.' : 'Vous n’avez pas encore d’amis sur Easevent : recherchez un membre ou choisissez « Autre personne ».')
                          : query.trim().length < 2 ? 'Tapez au moins 2 lettres du nom.' : 'Personne trouvée : choisissez « Autre personne » pour l’inviter par email ou SMS.'}
                      </Text>
                    )}
                    renderItem={({ item }) => (item.user
                      ? <Person id={item.user.id} name={item.user.name} initials={item.user.initials} sub="Ami" />
                      : <Person id={item.id} name={`${item.first_name} ${item.last_name}`} initials={item.initials} sub="Membre Easevent" />)}
                  />
                )}
              </View>
            )}
            <View style={styles.footer}>
              <PrimaryButton label={recipient ? `Continuer pour ${recipientName}` : 'Choisissez une personne'} disabled={!recipient}
                onPress={() => { setError(''); setStep('confirm'); }} />
            </View>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.panel} keyboardShouldPersistTaps="handled">
              <View style={styles.summary}>
                <Text style={styles.summaryLabel}>Pour</Text>
                <Text style={styles.summaryValue}>{recipientName}</Text>
                {recipient?.email || recipient?.phone ? <Text style={styles.summarySub}>{recipient.email || recipient.phone}</Text> : null}
              </View>
              <Text style={styles.label}>{`Un mot pour ${recipientName} (facultatif) · ${message.length}/300`}</Text>
              <TextInput value={message} onChangeText={(v) => setMessage(v.slice(0, 300))} multiline style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
                placeholder="Ex : Tu m’en parles depuis des mois, cette fois tu y vas !" placeholderTextColor={C.textMut}
                accessibilityLabel={`Message pour ${recipientName}`} />

              {isPaid ? (
                <>
                  <Text style={[styles.label, { marginTop: 18 }]}>Paiement</Text>
                  {[['card', 'card-outline', 'Carte bancaire', 'Visa, Mastercard, Apple Pay, Google Pay', price],
                    ...(mobileOk && fcfa !== null ? [['mobile', 'phone-portrait-outline', 'Orange Money · MTN MoMo', 'Validation sur votre téléphone', fcfaTxt]] : [])]
                    .map(([id, icon, label, sub, amount]) => {
                      const on = method === id;
                      return (
                        <Pressable key={id} onPress={() => setMethod(id)} style={[styles.person, on && styles.personOn, { marginBottom: 8 }]}
                          accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={`${label}, ${amount}`}>
                          <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? C.green : C.textMut} />
                          <Ionicons name={icon} size={20} color={C.text} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.personName}>{label}</Text>
                            <Text style={styles.personSub}>{sub}</Text>
                          </View>
                          <Text style={styles.eventPrice}>{amount}</Text>
                        </Pressable>
                      );
                    })}
                  <Price amount={event.price} currency={event.currency || 'EUR'} text={null} />
                </>
              ) : null}
              {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
              {step === 'waiting' ? (
                <View style={styles.waiting} accessibilityLiveRegion="polite">
                  <ActivityIndicator color={C.green} />
                  <Text style={styles.hint}>{useMobile ? 'Validez le paiement sur votre téléphone…' : 'Nous attendons la confirmation du paiement…'}</Text>
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.footer}>
              <PrimaryButton
                label={isPaid ? `Payer ${useMobile ? fcfaTxt : price} et offrir` : `Offrir ${pw.a}`}
                icon="gift-outline" loading={busy || step === 'waiting'} onPress={offer} />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  title: { flex: 1, fontSize: 19, fontWeight: '900', color: C.text, textAlign: 'center' },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, padding: 14, borderRadius: 16, backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  eventTitle: { fontSize: 15, fontWeight: '800', color: C.text },
  eventSub: { fontSize: 13, color: C.textSub, marginTop: 2 },
  eventPrice: { fontSize: 14, fontWeight: '800', color: C.text },
  question: { fontSize: 22, fontWeight: '900', color: C.text, marginHorizontal: 16, marginTop: 18, marginBottom: 10 },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: C.white, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border },
  tab: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: C.green },
  tabTxt: { fontSize: 13, fontWeight: '700', color: C.textSub },
  tabTxtOn: { color: C.white },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 10, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, minHeight: TOUCH },
  searchInput: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, minHeight: 60 },
  personOn: { borderColor: C.green, backgroundColor: C.greenLight },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontWeight: '800', color: C.green },
  personName: { fontSize: 15, fontWeight: '700', color: C.text },
  personSub: { fontSize: 12, color: C.textSub, marginTop: 2 },
  empty: { fontSize: 14, color: C.textSub, textAlign: 'center', marginTop: 24, lineHeight: 20, paddingHorizontal: 12 },
  panel: { padding: 16, paddingBottom: 30 },
  hint: { fontSize: 14, color: C.textSub, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: C.textSub, marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 15, color: C.text, backgroundColor: C.white },
  summary: { padding: 14, borderRadius: 14, backgroundColor: C.greenLight },
  summaryLabel: { fontSize: 12, fontWeight: '700', color: C.green, textTransform: 'uppercase', letterSpacing: 0.6 },
  summaryValue: { fontSize: 18, fontWeight: '800', color: C.text, marginTop: 2 },
  summarySub: { fontSize: 13, color: C.textSub, marginTop: 2 },
  error: { color: C.errorText, marginTop: 12, fontSize: 14 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  footer: { padding: 16, borderTopWidth: 1, borderColor: C.border, backgroundColor: C.white },
  doneIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  doneTitle: { fontSize: 22, fontWeight: '900', color: C.text, textAlign: 'center' },
  doneSub: { fontSize: 15, color: C.textSub, textAlign: 'center', marginTop: 10, lineHeight: 22, maxWidth: 380 },
});
