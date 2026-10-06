/**
 * GuestListScreen.js — Easevent (M13 « Invités & réponses »)
 * ════════════════════════════════════════════════════════════════
 * Paramètres : event, filter ('all' | 'confirmed' | 'pending' | 'declined').
 *
 * - Compteurs Confirmés / En attente / Déclinés (confirmé = ticket généré).
 * - Recherche (nom, email, numéro) et filtres.
 * - Appui sur un invité → actions : Relancer, Message (M16), Révoquer.
 *   (Une feuille d'actions plutôt qu'un glissement seul : utilisable
 *   au lecteur d'écran et au clavier.)
 * - « Relancer les N en attente » (une relance par invité et par jour).
 * - Export CSV (plan Standard).
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, Modal, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';

import { C, TOUCH } from '../constants/theme';
import { BackButton } from '../components/ui/Buttons';
import { Bone, SkeletonGroup } from '../components/ui/Skeleton';
import LoadingMessages, { MESSAGES } from '../components/ui/LoadingMessages';
import invitationService from '../services/invitationService';
import { apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';

const FILTERS = [
  { id: 'all', label: 'Tous' },
  { id: 'confirmed', label: 'Confirmés' },
  { id: 'pending', label: 'En attente' },
  { id: 'declined', label: 'Déclinés' },
];

const STATUS = {
  confirmed:   { label: 'Confirmé',         color: '#155C3C', bg: '#E8F5EE' },
  to_validate: { label: 'Ticket à valider', color: '#155C3C', bg: '#F1F8F4' },
  opened:      { label: 'Vu',               color: '#3B4BA8', bg: '#EEF1FD' },
  sent:        { label: 'En attente',       color: '#B4492E', bg: '#FFF0EB' },
  declined:    { label: 'Décliné',          color: '#C53030', bg: '#FFF5F5' },
  expired:     { label: 'Expiré',           color: '#555555', bg: '#F1F1F1' },
};
const KIND = { member: 'Membre', email: 'Email', phone: 'SMS' };
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const shortDate = (iso) => { const d = new Date(iso); return `${d.getDate()} ${MOIS[d.getMonth()]}`; };

function subtitle(g) {
  if (['failed', 'not_configured'].includes(g.delivery_status)) {
    return g.kind === 'phone' ? 'SMS non envoyé' : 'Email non envoyé';
  }
  const parts = [KIND[g.kind]];
  if (g.responded_at && ['confirmed', 'to_validate', 'declined'].includes(g.display_status)) {
    parts.push(`répondu le ${shortDate(g.responded_at)}`);
  } else if (g.opened_at) {
    parts.push(`ouvert le ${shortDate(g.opened_at)}`);
  } else if (g.reminded_at) {
    parts.push(`relancé le ${shortDate(g.reminded_at)}`);
  } else if (g.sent_at) {
    parts.push(`invité le ${shortDate(g.sent_at)}`);
  }
  return parts.join(' · ');
}

export default function GuestListScreen({ navigation, route }) {
  const event = route.params?.event || {};
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(route.params?.filter || 'all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await invitationService.participants(event.id));
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'La liste des invités est indisponible.'));
    } finally {
      setRefreshing(false);
    }
  }, [event.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const guests = data?.participants || [];
  const counts = data?.counts || { confirmed: 0, pending: 0, declined: 0, total: 0 };

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return guests.filter((g) => {
      if (filter !== 'all' && g.bucket !== filter) return false;
      if (!needle) return true;
      return [g.name, g.email, g.phone].some((v) => (v || '').toLowerCase().includes(needle));
    });
  }, [guests, filter, q]);

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'));
  const goPlans = () => navigation.navigate('TabProfile', { screen: 'Plans' });

  const run = async (key, fn, success) => {
    setBusy(key);
    try {
      const res = await fn();
      if (success) showAlert(success, res?.detail);
      await load();
    } catch (err) {
      showAlert('Action impossible', apiErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const remindOne = (g) => { setSelected(null); run(`remind-${g.id}`, () => invitationService.remind(g.id), 'Relance envoyée'); };

  const remindAll = () => {
    const n = data?.remindable || 0;
    showAlert('Relancer les invités en attente',
      `${n} invité${n > 1 ? 's' : ''} recevr${n > 1 ? 'ont' : 'a'} un nouveau lien par email ou SMS.`,
      [{ text: 'Annuler', style: 'cancel' },
        { text: 'Relancer', onPress: () => run('remind-all', () => invitationService.remindPending(event.id), 'Relances envoyées') }]);
  };

  const revoke = (g) => {
    setSelected(null);
    showAlert("Révoquer l'invitation",
      `${g.name} n'aura plus accès à l'événement. Son lien d'invitation ne fonctionnera plus.`,
      [{ text: 'Annuler', style: 'cancel' },
        { text: 'Révoquer', style: 'destructive', onPress: () => run(`revoke-${g.id}`, () => invitationService.revoke(g.id)) }]);
  };

  const message = (g) => {
    setSelected(null);
    navigation.navigate('Chat', { eventId: event.id, participantId: g.user_id, title: g.name });
  };

  const exportList = async () => {
    setBusy('export');
    try {
      const { url } = await invitationService.exportLink(event.id);
      if (Platform.OS === 'ios') await WebBrowser.openBrowserAsync(url);
      else await Linking.openURL(url);
    } catch (err) {
      if (err.response?.data?.code === 'plan_required') {
        showAlert('Export des invités', `${err.response.data.detail} Passez au plan Standard pour exporter votre liste (CSV, lisible dans Excel).`,
          [{ text: 'Plus tard', style: 'cancel' }, { text: 'Voir les plans', onPress: goPlans }]);
      } else {
        showAlert('Export impossible', apiErrorMessage(err));
      }
    } finally {
      setBusy('');
    }
  };

  const header = (
    <View style={styles.top}>
      <View style={styles.topBar}>
        <BackButton variant="square" onPress={goBack} />
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={styles.title} accessibilityRole="header">Invités</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{event.title}</Text>
        </View>
        <Pressable onPress={exportList} disabled={busy === 'export'} style={styles.iconBtn}
          accessibilityRole="button" accessibilityLabel="Exporter la liste des invités">
          {busy === 'export' ? <ActivityIndicator size="small" color={C.text} /> : <Ionicons name="download-outline" size={20} color={C.text} />}
        </Pressable>
      </View>

      <View style={styles.counters}>
        {[
          ['confirmed', counts.confirmed, 'confirmés', styles.cGreen, '#155C3C'],
          ['pending', counts.pending, 'en attente', styles.cOrange, '#B4492E'],
          ['declined', counts.declined, 'déclinés', styles.cGrey, '#444444'],
        ].map(([id, n, label, bg, color]) => (
          <Pressable key={id} onPress={() => setFilter(filter === id ? 'all' : id)} style={[styles.counter, bg, filter === id && styles.counterOn]}
            accessibilityRole="button" accessibilityLabel={`${n} ${label}. Filtrer`} accessibilityState={{ selected: filter === id }}>
            <Text style={[styles.counterN, { color }]}>{n}</Text>
            <Text style={[styles.counterL, { color }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.search}>
        <Ionicons name="search-outline" size={18} color={C.textMut} />
        <TextInput
          style={styles.searchInput}
          value={q}
          onChangeText={setQ}
          placeholder="Nom, email ou numéro"
          placeholderTextColor={C.textFaint}
          accessibilityLabel="Rechercher un invité"
          autoCorrect={false}
        />
        {q ? <Pressable onPress={() => setQ('')} accessibilityLabel="Effacer la recherche" style={styles.clear}><Ionicons name="close-circle" size={18} color={C.textMut} /></Pressable> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          const n = f.id === 'all' ? counts.total : counts[f.id];
          return (
            <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[styles.filter, on && styles.filterOn]}
              accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Text style={[styles.filterTxt, on && styles.filterTxtOn]}>{f.label}{f.id === 'all' ? ` ${n}` : ''}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {header}

        {!data && !error ? (
          <SkeletonGroup label="Chargement des invités" style={{ padding: 16, gap: 8 }}>
            <LoadingMessages messages={MESSAGES.guests} style={{ marginBottom: 6 }} />
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.rowSkel}>
                <Bone width={42} height={42} radius={21} />
                <View style={{ flex: 1, gap: 6 }}><Bone width="55%" /><Bone width="35%" height={10} /></View>
                <Bone width={64} height={22} radius={8} />
              </View>
            ))}
          </SkeletonGroup>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.green} colors={[C.green]} />}
            ListHeaderComponent={error ? <View style={styles.error} accessibilityRole="alert"><Text style={styles.errorTxt}>{error}</Text></View> : null}
            ListEmptyComponent={!error ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={40} color={C.textMut} />
                <Text style={styles.emptyTitle}>{counts.total ? 'Aucun invité ne correspond' : 'Aucun invité pour le moment'}</Text>
                <Text style={styles.emptyTxt}>{counts.total ? 'Modifiez la recherche ou le filtre.' : 'Invitez des membres, par email ou par SMS.'}</Text>
              </View>
            ) : null}
            renderItem={({ item: g }) => {
              const st = STATUS[g.display_status] || STATUS.sent;
              const rowBusy = busy.endsWith(g.id);
              return (
                <Pressable
                  onPress={() => setSelected(g)}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.name}, ${st.label}, ${subtitle(g)}`}
                  accessibilityHint="Ouvre les actions : relancer, message, révoquer"
                >
                  <View style={[styles.avatar, g.bucket === 'pending' ? { backgroundColor: C.orangeL } : g.bucket === 'confirmed' ? null : { backgroundColor: '#F1F1F1' }]}>
                    {g.kind === 'phone' && !g.initials
                      ? <Ionicons name="phone-portrait-outline" size={18} color={C.textSub} />
                      : g.kind === 'email' && !g.initials
                        ? <Ionicons name="mail-outline" size={18} color={C.textSub} />
                        : <Text style={[styles.avatarTxt, g.bucket === 'pending' && { color: C.orangeDark }]}>{g.initials}</Text>}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name} numberOfLines={1}>{g.name}</Text>
                    <Text style={[styles.sub, ['failed', 'not_configured'].includes(g.delivery_status) && { color: C.errorText }]} numberOfLines={1}>{subtitle(g)}</Text>
                  </View>
                  {rowBusy ? <ActivityIndicator size="small" color={C.green} /> : (
                    <View style={[styles.badge, { backgroundColor: st.bg }]}><Text style={[styles.badgeTxt, { color: st.color }]}>{st.label}</Text></View>
                  )}
                </Pressable>
              );
            }}
          />
        )}

        <View style={styles.footer}>
          <Pressable
            onPress={remindAll}
            disabled={!data?.remindable || busy === 'remind-all'}
            style={[styles.footBtn, styles.footGhost, (!data?.remindable) && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !data?.remindable }}
          >
            {busy === 'remind-all' ? <ActivityIndicator size="small" color={C.text} /> : null}
            <Text style={styles.footGhostTxt}>{data?.remindable ? `Relancer les ${data.remindable}` : 'Personne à relancer'}</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('InviteGuests', { event })} style={[styles.footBtn, styles.footPrimary]} accessibilityRole="button">
            <Ionicons name="add" size={18} color={C.white} />
            <Text style={styles.footPrimaryTxt}>Inviter</Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.shade} onPress={() => setSelected(null)} accessibilityLabel="Fermer" />
        {selected && (
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle} accessibilityRole="header">{selected.name}</Text>
            <Text style={styles.sheetSub}>{subtitle(selected)} · {(STATUS[selected.display_status] || STATUS.sent).label}</Text>
            <SheetAction icon="refresh-outline" label="Relancer" color={C.green}
              note={selected.can_remind ? 'Un nouveau lien est envoyé.' : (['sent', 'opened'].includes(selected.status) ? 'Déjà relancé il y a moins de 24 h.' : 'Cet invité a déjà répondu.')}
              disabled={!selected.can_remind} onPress={() => remindOne(selected)} />
            <SheetAction icon="chatbubble-ellipses-outline" label="Message" color={C.orange}
              note={selected.user_id ? 'Ouvrir la conversation.' : 'Disponible quand l’invité a un compte Easevent.'}
              disabled={!selected.user_id} onPress={() => message(selected)} />
            <SheetAction icon="close-circle-outline" label="Révoquer l'invitation" color="#C0392B"
              note="Son lien ne fonctionnera plus." onPress={() => revoke(selected)} />
            <Pressable onPress={() => setSelected(null)} style={styles.sheetClose} accessibilityRole="button">
              <Text style={styles.sheetCloseTxt}>Fermer</Text>
            </Pressable>
          </View>
        )}
      </Modal>
    </View>
  );
}

function SheetAction({ icon, label, note, color, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.action, disabled && { opacity: 0.45 }]}
      accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} accessibilityHint={note}>
      <View style={[styles.actionIcon, { backgroundColor: `${color}1A` }]}><Ionicons name={icon} size={20} color={color} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionNote}>{note}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  top: { backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, gap: 14 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '800', color: C.text },
  subtitle: { fontSize: 12, color: C.textMut, marginTop: 2, maxWidth: 220 },
  iconBtn: { width: TOUCH, height: TOUCH, borderRadius: 22, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  counters: { flexDirection: 'row', gap: 8 },
  counter: { flex: 1, borderRadius: 16, padding: 12, borderWidth: 2, borderColor: 'transparent' },
  counterOn: { borderColor: C.text },
  cGreen: { backgroundColor: '#E8F5EE' },
  cOrange: { backgroundColor: '#FFF0EB' },
  cGrey: { backgroundColor: '#F4F4F4' },
  counterN: { fontSize: 24, fontWeight: '800' },
  counterL: { fontSize: 12, fontWeight: '600' },
  search: { minHeight: 46, borderRadius: 14, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 14, color: C.text, paddingVertical: 10 },
  clear: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 6 },
  filter: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  filterOn: { backgroundColor: C.text, borderColor: C.text },
  filterTxt: { fontSize: 13, fontWeight: '600', color: C.text },
  filterTxtOn: { color: C.white, fontWeight: '700' },
  list: { padding: 16, gap: 8, paddingBottom: 24, width: '100%', maxWidth: 640, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: C.white, minHeight: 66 },
  rowSkel: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, backgroundColor: C.white },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E8F5EE', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 14, fontWeight: '700', color: '#155C3C' },
  name: { fontSize: 15, fontWeight: '600', color: C.text },
  sub: { fontSize: 12, color: '#6B6B6B', marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  emptyTxt: { fontSize: 13, color: C.textSub, textAlign: 'center' },
  error: { backgroundColor: C.errorBg, borderRadius: 12, padding: 12, marginBottom: 8 },
  errorTxt: { fontSize: 13, color: C.errorText },
  footer: { flexDirection: 'row', gap: 10, padding: 12, paddingHorizontal: 16, paddingBottom: 24, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: '#EFEFEF' },
  footBtn: { flex: 1, minHeight: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footGhost: { borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  footGhostTxt: { fontSize: 14, fontWeight: '700', color: C.text },
  footPrimary: { backgroundColor: C.green },
  footPrimaryTxt: { fontSize: 15, fontWeight: '700', color: C.white },
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28, gap: 6 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  sheetSub: { fontSize: 13, color: C.textSub, marginBottom: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingVertical: 6 },
  actionIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 15, fontWeight: '700', color: C.text },
  actionNote: { fontSize: 12, color: C.textSub, marginTop: 1 },
  sheetClose: { minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  sheetCloseTxt: { fontSize: 15, fontWeight: '700', color: C.textSub },
});
