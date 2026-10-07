/**
 * NotificationsScreen.js — Easevent (M17 « Notifications »)
 * ════════════════════════════════════════════════════════════════
 * Filtres Tout / Événements / Messages / Système, regroupement par
 * période, « Tout marquer lu », préférences (rappels, bilan du jour).
 *
 * Destination au clic (MVP §4, M17) :
 *  invitation_received → Accepter / Décliner ici, sinon Mes tickets › En attente
 *  ticket_to_validate  → Mes tickets › En attente
 *  ticket_generated, reminder → le ticket (M27)
 *  daily_summary       → Gérer l'événement (M11)
 *  message_received    → la conversation (M16)
 *  payment_failed      → Mes tickets › En attente
 *  payment_succeeded   → Plans (M22)
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, SectionList,
  StyleSheet, Switch, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { C, TOUCH } from '../constants/theme';
import { BackButton } from '../components/ui/Buttons';
import { Bone, SkeletonGroup } from '../components/ui/Skeleton';
import LoadingMessages from '../components/ui/LoadingMessages';
import notificationService from '../services/notificationService';
import eventService from '../services/eventService';
import friendService from '../services/friendService';
import { apiErrorMessage } from '../services/authService';
import { useTicketBadge } from '../context/TicketBadgeContext';
import { showAlert } from '../utils/dialog';
import { isRsvpCancel } from '../utils/rsvp';
import { openNotification } from '../utils/notificationRoutes';
import realtime from '../services/realtime';

const FILTERS = [
  { id: 'all', label: 'Tout' },
  { id: 'events', label: 'Événements' },
  { id: 'messages', label: 'Messages' },
  { id: 'social', label: 'Amis' },
  { id: 'system', label: 'Système' },
];

const LOADING = ['Nous relevons votre courrier…', 'On trie vos nouvelles…', 'Encore un instant…'];

// Pastille par type : icône, couleurs, appel à l'action
const LOOK = {
  invitation_received: { icon: 'mail-open-outline', bg: C.greenLight, fg: C.green },
  ticket_to_validate:  { icon: 'ticket-outline', bg: C.green, fg: C.white, cta: 'Valider mon invitation' },
  ticket_generated:    { icon: 'qr-code-outline', bg: C.greenLight, fg: C.green, cta: 'Voir' },
  ticket_gift:         { icon: 'gift-outline', bg: C.greenLight, fg: C.green, cta: 'Voir' },
  question_to_answer:  { icon: 'help-circle-outline', bg: C.orangeL, fg: C.orangeDark, cta: 'Répondre' },
  daily_summary:       { icon: 'people-outline', bg: C.greenLight, fg: C.green },
  reminder:            { icon: 'time-outline', bg: '#FFF6E0', fg: '#7A4F00', cta: 'Voir' },
  message_received:    { icon: 'chatbubble-outline', bg: C.orangeL, fg: C.orangeDark },
  payment_failed:      { icon: 'card-outline', bg: C.errorBg, fg: C.errorText, cta: 'Réessayer le paiement' },
  payment_succeeded:   { icon: 'card-outline', bg: C.greenLight, fg: C.green, cta: 'Voir' },
  payment_refunded:    { icon: 'arrow-undo-outline', bg: '#F4F4F4', fg: C.text },
  guest_response:      { icon: 'people-circle-outline', bg: C.greenLight, fg: C.green, cta: 'Voir les réponses' },
  event_full:          { icon: 'trophy-outline', bg: '#FFF6E0', fg: '#7A4F00' },
  event_updated:       { icon: 'create-outline', bg: '#FFF6E0', fg: '#7A4F00', cta: "Voir l'événement" },
  event_cancelled:     { icon: 'close-circle-outline', bg: C.errorBg, fg: C.errorText },
  invitation_revoked:  { icon: 'remove-circle-outline', bg: '#F4F4F4', fg: C.text },
  payouts_ready:       { icon: 'wallet-outline', bg: C.greenLight, fg: C.green },
  minisite_ready:      { icon: 'sparkles-outline', bg: C.greenLight, fg: C.green, cta: 'Choisir mon mini-site' },
  subscription:        { icon: 'star-outline', bg: C.orangeL, fg: C.orangeDark, cta: 'Mon abonnement' },
  friend_request:      { icon: 'person-add-outline', bg: C.greenLight, fg: C.green },
  friend_accepted:     { icon: 'people-outline', bg: C.greenLight, fg: C.green, cta: 'Voir mes amis' },
};

function ago(iso) {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d) / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24 && new Date().toDateString() === d.toDateString()) return `Il y a ${h} h`;
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const hh = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if ((Date.now() - d) / 86400000 < 7) return `${jours[d.getDay()]} · ${hh}`;
  return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')} · ${hh}`;
}

function section(iso) {
  const d = new Date(iso);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = (today - new Date(d).setHours(0, 0, 0, 0)) / 86400000;
  if (diff <= 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  if (diff < 7) return 'Cette semaine';
  return 'Plus ancien';
}

export default function NotificationsScreen({ navigation }) {
  const { setNotifications, refresh: refreshBadges } = useTicketBadge();
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState(null);
  const [unread, setUnread] = useState({ all: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState('');
  const [prefsOpen, setPrefsOpen] = useState(false);

  const applyUnread = useCallback((u) => { if (u) { setUnread(u); setNotifications(u.all); } }, [setNotifications]);

  const load = useCallback(async (category = filter) => {
    try {
      const data = await notificationService.list({ category });
      setItems(data.results);
      setHasMore(data.has_more);
      applyUnread(data.unread);
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Les notifications sont indisponibles.'));
    } finally {
      setRefreshing(false);
    }
  }, [filter, applyUnread]);

  useFocusEffect(useCallback(() => {
    load();
    // Nouvelle notification pendant que l'écran est ouvert : la liste se met à jour seule
    let timer = null;
    const unsub = realtime.subscribe((evt) => {
      if (evt.type !== 'badge') return;
      clearTimeout(timer);
      timer = setTimeout(() => load(), 600);
    });
    return () => { unsub(); clearTimeout(timer); };
  }, [load]));

  const changeFilter = (id) => { setFilter(id); setItems(null); load(id); };

  const loadMore = async () => {
    if (!items?.length) return;
    setLoadingMore(true);
    try {
      const data = await notificationService.list({ category: filter, before: items[items.length - 1].created_at });
      setItems((prev) => [...prev, ...data.results]);
      setHasMore(data.has_more);
    } catch (err) {
      showAlert('Chargement impossible', apiErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const markRead = async (n) => {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    try { applyUnread((await notificationService.markRead(n.id)).unread); } catch { /* sans gravité */ }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    try { applyUnread((await notificationService.markAllRead(filter)).unread); } catch { load(); }
  };

  const open = (n) => {
    markRead(n);
    openNotification(navigation, n);
  };

  const answer = async (n, status) => {
    setBusy(`${n.id}:${status}`);
    try {
      await eventService.respondToInvitation(n.invitation.id, status);
      await markRead(n);
      refreshBadges({ force: true });
      if (status === 'confirmed') {
        showAlert('Invitation acceptée', 'Elle vous attend dans Mes invitations : validez-la pour recevoir votre QR code.', [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Voir mon invitation', onPress: () => navigation.navigate('TabTickets', { screen: 'Tickets', params: { tab: 'pending' } }) },
        ]);
      }
      await load();
    } catch (err) {
      if (isRsvpCancel(err)) return;      // fenêtre des questions fermée : rien n'est envoyé
      showAlert('Action impossible', apiErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const answerFriend = async (n, ok) => {
    setBusy(`${n.id}:friend-${ok ? 'ok' : 'no'}`);
    try {
      if (ok) await friendService.accept(n.friendship.id); else await friendService.remove(n.friendship.id);
      await markRead(n);
      await load();
    } catch (err) {
      showAlert('Action impossible', apiErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const sections = useMemo(() => {
    const groups = [];
    (items || []).forEach((n) => {
      const title = section(n.created_at);
      const g = groups.find((x) => x.title === title);
      if (g) g.data.push(n); else groups.push({ title, data: [n] });
    });
    return groups;
  }, [items]);

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabDashboard', { screen: 'Dashboard' }));

  const renderItem = ({ item: n }) => {
    const look = LOOK[n.type] || LOOK.payment_succeeded;
    const canAnswer = n.type === 'invitation_received' && n.invitation?.can_answer;
    const canAnswerFriend = n.type === 'friend_request' && n.friendship?.can_answer;
    return (
      <Pressable
        onPress={() => open(n)}
        style={({ pressed }) => [styles.item, !n.read && styles.itemUnread, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={`${n.read ? '' : 'Non lue. '}${n.title} ${n.body}. ${ago(n.created_at)}`}
      >
        {n.type === 'invitation_received' && n.event?.cover_image ? (
          <Image source={{ uri: n.event.cover_image }} style={styles.thumb} accessibilityIgnoresInvertColors />
        ) : n.type === 'message_received' && n.actor ? (
          <View style={[styles.thumb, styles.round, { backgroundColor: C.orangeL }]}><Text style={styles.initials}>{n.actor.initials}</Text></View>
        ) : (
          <View style={[styles.thumb, { backgroundColor: look.bg }]}><Ionicons name={look.icon} size={20} color={look.fg} /></View>
        )}
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={styles.text}><Text style={styles.bold}>{n.title}</Text> {n.body}</Text>
          {canAnswer && (
            <View style={styles.answers}>
              <Pressable onPress={() => answer(n, 'confirmed')} disabled={!!busy} style={[styles.answer, styles.accept]}
                accessibilityRole="button" accessibilityLabel={`Accepter l'invitation à ${n.event?.title || ''}`}>
                {busy === `${n.id}:confirmed` ? <ActivityIndicator size="small" color={C.white} /> : <Text style={styles.acceptTxt}>Accepter</Text>}
              </Pressable>
              <Pressable onPress={() => answer(n, 'declined')} disabled={!!busy} style={[styles.answer, styles.decline]}
                accessibilityRole="button" accessibilityLabel={`Décliner l'invitation à ${n.event?.title || ''}`}>
                {busy === `${n.id}:declined` ? <ActivityIndicator size="small" color={C.text} /> : <Text style={styles.declineTxt}>Décliner</Text>}
              </Pressable>
            </View>
          )}
          {canAnswerFriend && (
            <View style={styles.answers}>
              <Pressable onPress={() => answerFriend(n, true)} disabled={!!busy} style={[styles.answer, styles.accept]}
                accessibilityRole="button" accessibilityLabel={`Accepter la demande d'ami de ${n.title}`}>
                {busy === `${n.id}:friend-ok` ? <ActivityIndicator size="small" color={C.white} /> : <Text style={styles.acceptTxt}>Accepter</Text>}
              </Pressable>
              <Pressable onPress={() => answerFriend(n, false)} disabled={!!busy} style={[styles.answer, styles.decline]}
                accessibilityRole="button" accessibilityLabel={`Refuser la demande d'ami de ${n.title}`}>
                <Text style={styles.declineTxt}>Refuser</Text>
              </Pressable>
            </View>
          )}
          {look.cta && !n.read ? <Text style={styles.cta}>{look.cta} ›</Text> : null}
          <Text style={styles.time}>{n.type === 'daily_summary' ? `Bilan du jour · ${ago(n.created_at)}` : ago(n.created_at)}</Text>
        </View>
        {!n.read && <View style={styles.dot} accessibilityElementsHidden />}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.head}>
          <View style={styles.headRow}>
            <BackButton variant="square" onPress={goBack} />
            <Text style={styles.h1} accessibilityRole="header">Notifications</Text>
            <Pressable onPress={() => setPrefsOpen(true)} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Préférences de notification">
              <Ionicons name="options-outline" size={20} color={C.text} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
            {FILTERS.map((f) => {
              const on = filter === f.id;
              const n = unread[f.id] || 0;
              return (
                <Pressable key={f.id} onPress={() => changeFilter(f.id)} style={[styles.filter, on && styles.filterOn]}
                  accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on}
                  accessibilityLabel={`${f.label}${n ? `, ${n} non lue${n > 1 ? 's' : ''}` : ''}`}>
                  <Text style={[styles.filterTxt, on && styles.filterTxtOn]}>{f.label}{n ? ` · ${n}` : ''}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {items === null && !error ? (
          <SkeletonGroup label="Chargement des notifications" style={{ padding: 20, gap: 18 }}>
            <LoadingMessages messages={LOADING} />
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                <Bone width={44} height={44} radius={14} />
                <View style={{ flex: 1, gap: 8 }}><Bone width="85%" /><Bone width="30%" height={10} /></View>
              </View>
            ))}
          </SkeletonGroup>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(n) => n.id}
            renderItem={renderItem}
            stickySectionHeadersEnabled={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.green} colors={[C.green]} />}
            renderSectionHeader={({ section: s }) => (
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle} accessibilityRole="header">{s.title}</Text>
                {s.title === sections[0]?.title && unread[filter] > 0 ? (
                  <Pressable onPress={markAll} accessibilityRole="button" style={styles.markAll}>
                    <Text style={styles.markAllTxt}>Tout marquer lu</Text>
                  </Pressable>
                ) : null}
              </View>
            )}
            ListHeaderComponent={error ? <View style={styles.error} accessibilityRole="alert"><Text style={styles.errorTxt}>{error}</Text></View> : null}
            ListEmptyComponent={!error ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><Ionicons name="notifications-off-outline" size={30} color={C.green} /></View>
                <Text style={styles.emptyTitle}>Rien de neuf pour le moment</Text>
                <Text style={styles.emptyTxt}>Invitations, billets et rappels de vos événements apparaîtront ici.</Text>
              </View>
            ) : null}
            ListFooterComponent={hasMore ? (
              <Pressable onPress={loadMore} disabled={loadingMore} style={styles.more} accessibilityRole="button">
                {loadingMore ? <ActivityIndicator color={C.green} /> : <Text style={styles.moreTxt}>Voir les notifications plus anciennes</Text>}
              </Pressable>
            ) : <View style={{ height: 24 }} />}
          />
        )}
      </SafeAreaView>

      <PreferencesSheet visible={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Préférences
// ─────────────────────────────────────────────────────────────
function PreferencesSheet({ visible, onClose }) {
  const [prefs, setPrefs] = useState(null);
  const [error, setError] = useState('');

  const onShow = async () => {
    setError('');
    try { setPrefs(await notificationService.preferences()); } catch (err) { setError(apiErrorMessage(err)); }
  };

  const toggle = async (key, value) => {
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    try { setPrefs(await notificationService.updatePreferences({ [key]: value })); } catch (err) {
      setPrefs(previous);
      setError(apiErrorMessage(err));
    }
  };

  const rows = [
    ['push', 'Notifications sur le téléphone', 'Recevoir les alertes même quand l\'application est fermée.'],
    ['messages', 'Nouveaux messages', 'Une alerte à chaque message reçu.'],
    ['guest_responses', 'Réponses de mes invités (organisateur)', 'Quand un invité accepte, décline ou prend son billet.'],
    ['reminders', 'Rappels avant mes événements', 'J-7, la veille et le jour J pour vos invitations et billets.'],
    ['daily_summary', 'Bilan du jour (organisateur)', 'Le nombre de nouvelles confirmations de vos événements.'],
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onShow={onShow} onRequestClose={onClose}>
      <Pressable style={styles.shade} onPress={onClose} accessibilityLabel="Fermer" />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle} accessibilityRole="header">Préférences de notification</Text>
        {!prefs && !error ? <ActivityIndicator color={C.green} style={{ marginVertical: 24 }} /> : null}
        {prefs && rows.map(([key, label, hint]) => (
          <View key={key} style={styles.prefRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefLabel}>{label}</Text>
              <Text style={styles.prefHint}>{hint}</Text>
            </View>
            <Switch value={!!prefs[key]} onValueChange={(v) => toggle(key, v)} accessibilityLabel={label}
              trackColor={{ true: C.green, false: C.border }} thumbColor={C.white} />
          </View>
        ))}
        <Text style={styles.prefNote}>Les invitations, billets et paiements vous sont toujours signalés.</Text>
        {error ? <Text style={styles.errorTxt} accessibilityRole="alert">{error}</Text> : null}
        <Pressable onPress={onClose} style={styles.sheetClose} accessibilityRole="button">
          <Text style={styles.sheetCloseTxt}>Fermer</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  head: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h1: { flex: 1, fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.4 },
  iconBtn: { width: TOUCH, height: TOUCH, borderRadius: 22, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 6 },
  filter: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  filterOn: { backgroundColor: C.text, borderColor: C.text },
  filterTxt: { fontSize: 13, fontWeight: '600', color: C.text },
  filterTxtOn: { color: C.white, fontWeight: '700' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase', color: '#6B6B6B' },
  markAll: { minHeight: 32, justifyContent: 'center' },
  markAllTxt: { fontSize: 13, fontWeight: '700', color: C.green },
  item: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 14 },
  itemUnread: { backgroundColor: '#F6FBF8' },
  thumb: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  round: { borderRadius: 22 },
  initials: { fontSize: 14, fontWeight: '700', color: C.orangeDark },
  text: { fontSize: 14, lineHeight: 20, color: C.text },
  bold: { fontWeight: '700' },
  answers: { flexDirection: 'row', gap: 8 },
  answer: { minHeight: 40, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  accept: { backgroundColor: C.green },
  acceptTxt: { fontSize: 13, fontWeight: '700', color: C.white },
  decline: { borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  declineTxt: { fontSize: 13, fontWeight: '600', color: C.text },
  cta: { fontSize: 12, fontWeight: '700', color: C.green },
  time: { fontSize: 12, color: '#6B6B6B' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.orange, marginTop: 6 },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  emptyTxt: { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 19 },
  error: { margin: 20, backgroundColor: C.errorBg, borderRadius: 12, padding: 12 },
  errorTxt: { fontSize: 13, color: C.errorText },
  more: { minHeight: 52, alignItems: 'center', justifyContent: 'center', margin: 16 },
  moreTxt: { fontSize: 14, fontWeight: '700', color: C.green },
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28, gap: 6 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 6 },
  prefRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderBottomWidth: 1, borderBottomColor: C.border },
  prefLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  prefHint: { fontSize: 12, color: C.textSub, marginTop: 2 },
  prefNote: { fontSize: 12, color: C.textMut, marginTop: 10 },
  sheetClose: { minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  sheetCloseTxt: { fontSize: 15, fontWeight: '700', color: C.textSub },
});
