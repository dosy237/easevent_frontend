/**
 * ConversationsScreen.js — Easevent (M15 « Messagerie »)
 * ════════════════════════════════════════════════════════════════
 * Paramètres facultatifs : eventId, eventTitle (depuis M11 : filtre).
 * Conversations où l'utilisateur est organisateur ou invité : interlocuteur,
 * événement, dernier message (« A accepté votre invitation » pour les
 * événements système), heure, non lus. Recherche et filtre par événement.
 * Le crayon (organisateur) ouvre la liste des invités d'un événement,
 * d'où l'on démarre une conversation.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { C, TOUCH } from '../constants/theme';
import { BackButton } from '../components/ui/Buttons';
import { Bone, SkeletonGroup } from '../components/ui/Skeleton';
import LoadingMessages from '../components/ui/LoadingMessages';
import messageService from '../services/messageService';
import eventService from '../services/eventService';
import { apiErrorMessage } from '../services/authService';
import { useTicketBadge } from '../context/TicketBadgeContext';

const LOADING = ['Nous ouvrons vos conversations…', 'On rassemble les messages…', 'Encore un instant…'];
const SYSTEM_LOOK = {
  invitation_sent: ['mail-outline', C.textSub],
  invitation_accepted: ['checkmark-circle', C.greenDark],
  invitation_declined: ['close-circle', C.errorText],
  ticket_generated: ['ticket', C.greenDark],
};
const AVATAR_TINTS = [['#E8F5EE', '#1B6B4A'], ['#FFF0EB', '#C4502F'], ['#EFF6FF', '#2563EB'], ['#F5F0FF', '#6D28D9']];
const tint = (id) => AVATAR_TINTS[(id || '').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_TINTS.length];

function when(iso) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Hier';
  if ((now - d) / 86400000 < 7) return ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'][d.getDay()];
  return `${d.getDate()} ${['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'][d.getMonth()]}`;
}

export default function ConversationsScreen({ navigation, route }) {
  const { setMessages, refresh: refreshBadges } = useTicketBadge();
  const [eventId, setEventId] = useState(route.params?.eventId || null);
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [events, setEvents] = useState(route.params?.eventId ? [{ id: route.params.eventId, title: route.params.eventTitle || 'Cet événement' }] : []);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [picker, setPicker] = useState(null);       // événements de l'organisateur (crayon)
  const timer = useRef(null);

  const load = useCallback(async (search = q, ev = eventId) => {
    try {
      const res = await messageService.list({ eventId: ev, q: search.trim() });
      setData(res);
      if (!ev && !search.trim()) {
        setEvents(res.events);
        setMessages(res.results.reduce((n, c) => n + c.unread, 0));
      }
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, 'La messagerie est indisponible.'));
    } finally {
      setRefreshing(false);
    }
  }, [q, eventId, setMessages]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => () => clearTimeout(timer.current), []);

  const search = (text) => {
    setQ(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(text, eventId), 350);
  };

  const pickEvent = (id) => { setEventId(id); setData(null); load(q, id); };

  const openPicker = async () => {
    setPicker([]);
    try {
      const res = await eventService.fetchMyEvents();
      setPicker((res.events || res.results || res || []).filter((e) => e.status !== 'archived'));
    } catch {
      setPicker(null);
    }
  };

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'));
  const unreadConvs = data?.unread_conversations || 0;

  const chips = useMemo(() => [{ id: null, title: 'Tous' }, ...events], [events]);

  const renderItem = ({ item: c }) => {
    const [bg, fg] = tint(c.other.id);
    const unread = c.unread > 0;
    const last = c.last_message;
    return (
      <Pressable
        onPress={() => { refreshBadges({ force: true }); navigation.navigate('Chat', { conversationId: c.id, title: c.other.name }); }}
        style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={`${c.other.name}, ${c.event.title}. ${last ? (last.from_me ? 'Vous : ' : '') + last.text : ''}${unread ? `. ${c.unread} non lu${c.unread > 1 ? 's' : ''}` : ''}`}
      >
        <View>
          <View style={[styles.avatar, { backgroundColor: bg }]}><Text style={[styles.avatarTxt, { color: fg }]}>{c.other.initials}</Text></View>
          {c.online && <View style={styles.online} />}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, unread && { fontWeight: '800' }]} numberOfLines={1}>{c.other.name}</Text>
            {last && <Text style={[styles.time, unread && styles.timeUnread]}>{when(last.created_at)}</Text>}
          </View>
          <Text style={[styles.event, !unread && { color: C.textMut }]} numberOfLines={1}>
            {c.event.title.toUpperCase()}{c.role === 'participant' ? ' · ORGANISATEUR' : ''}
          </Text>
          <View style={styles.rowBottom}>
            {last?.is_system ? (
              <View style={styles.system}>
                <Ionicons name={SYSTEM_LOOK[last.system_type]?.[0] || 'information-circle'} size={14} color={SYSTEM_LOOK[last.system_type]?.[1] || C.textMut} />
                <Text style={[styles.systemTxt, { color: SYSTEM_LOOK[last.system_type]?.[1] || C.textMut }]} numberOfLines={1}>{last.text}</Text>
              </View>
            ) : (
              <Text style={[styles.preview, unread && styles.previewUnread]} numberOfLines={1}>
                {last ? `${last.from_me ? 'Vous : ' : ''}${last.text}` : 'Aucun message'}
              </Text>
            )}
            {unread && <View style={styles.badge}><Text style={styles.badgeTxt}>{c.unread}</Text></View>}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.head}>
          <View style={styles.headRow}>
            <BackButton variant="square" onPress={goBack} />
            <View style={{ flex: 1 }}>
              <Text style={styles.h1} accessibilityRole="header">Messages</Text>
              <Text style={styles.sub}>
                {unreadConvs ? `${unreadConvs} conversation${unreadConvs > 1 ? 's' : ''} non lue${unreadConvs > 1 ? 's' : ''}` : 'Tout est lu'}
              </Text>
            </View>
            <Pressable onPress={openPicker} style={styles.compose} accessibilityRole="button" accessibilityLabel="Nouveau message à un invité">
              <Ionicons name="create-outline" size={20} color={C.green} />
            </Pressable>
          </View>
          <View style={styles.search}>
            <Ionicons name="search-outline" size={18} color={C.textMut} />
            <TextInput style={styles.searchInput} value={q} onChangeText={search} placeholder="Rechercher un invité"
              placeholderTextColor={C.textFaint} accessibilityLabel="Rechercher une conversation" autoCorrect={false} />
          </View>
          {chips.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} accessibilityRole="tablist">
              {chips.map((e) => {
                const on = eventId === e.id;
                return (
                  <Pressable key={e.id || 'all'} onPress={() => pickEvent(e.id)} style={[styles.chip, on && styles.chipOn]}
                    accessibilityRole="tab" accessibilityState={{ selected: on }}>
                    <Text style={[styles.chipTxt, on && styles.chipTxtOn]} numberOfLines={1}>{e.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {!data && !error ? (
          <SkeletonGroup label="Chargement des conversations" style={{ padding: 20, gap: 18, backgroundColor: C.white }}>
            <LoadingMessages messages={LOADING} />
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
                <Bone width={50} height={50} radius={25} />
                <View style={{ flex: 1, gap: 8 }}><Bone width="50%" /><Bone width="35%" height={10} /><Bone width="80%" height={12} /></View>
              </View>
            ))}
          </SkeletonGroup>
        ) : (
          <FlatList
            data={data?.results || []}
            keyExtractor={(c) => c.id}
            renderItem={renderItem}
            style={{ backgroundColor: C.white }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.green} colors={[C.green]} />}
            ListHeaderComponent={error ? <View style={styles.error} accessibilityRole="alert"><Text style={styles.errorTxt}>{error}</Text></View> : null}
            ListEmptyComponent={!error ? (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><Ionicons name="chatbubbles-outline" size={30} color={C.green} /></View>
                <Text style={styles.emptyTitle}>{q ? 'Aucune conversation trouvée' : 'Aucune conversation'}</Text>
                <Text style={styles.emptyTxt}>
                  {q ? 'Essayez un autre nom.' : 'Écrivez à un invité depuis la liste des invités, ou à un organisateur depuis la page de son événement.'}
                </Text>
              </View>
            ) : null}
          />
        )}
      </SafeAreaView>

      <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.shade} onPress={() => setPicker(null)} accessibilityLabel="Fermer" />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle} accessibilityRole="header">Écrire à un invité</Text>
          <Text style={styles.sheetSub}>Choisissez l'événement, puis l'invité dans la liste.</Text>
          {picker?.length === 0 ? <Text style={styles.sheetSub}>Chargement…</Text> : null}
          <FlatList
            data={picker || []}
            keyExtractor={(e) => e.id}
            style={{ maxHeight: 360 }}
            renderItem={({ item: e }) => (
              <Pressable style={styles.eventRow} accessibilityRole="button"
                onPress={() => { setPicker(null); navigation.navigate('GuestList', { event: e, filter: 'all' }); }}>
                <Ionicons name="calendar-outline" size={18} color={C.green} />
                <Text style={styles.eventRowTxt} numberOfLines={1}>{e.title}</Text>
                <Ionicons name="chevron-forward" size={16} color={C.textMut} />
              </Pressable>
            )}
          />
          <Pressable onPress={() => setPicker(null)} style={styles.sheetClose} accessibilityRole="button">
            <Text style={styles.sheetCloseTxt}>Fermer</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  head: { backgroundColor: C.white, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 14 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  h1: { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: C.textMut },
  compose: { width: TOUCH, height: TOUCH, borderRadius: 14, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  search: { minHeight: 44, borderRadius: 12, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 10 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 100, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white, maxWidth: 220 },
  chipOn: { backgroundColor: C.green, borderColor: C.green },
  chipTxt: { fontSize: 13, fontWeight: '600', color: C.textSub },
  chipTxtOn: { color: C.white },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  rowUnread: { backgroundColor: '#F6FBF8' },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 17, fontWeight: '800' },
  online: { position: 'absolute', right: 1, bottom: 1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#2ECC71', borderWidth: 2, borderColor: C.white },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: '700', color: C.text },
  time: { fontSize: 12, color: C.textMut },
  timeUnread: { color: C.green, fontWeight: '700' },
  event: { fontSize: 11, fontWeight: '700', color: '#C4502F', marginTop: 2, marginBottom: 3 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  preview: { flex: 1, fontSize: 13, color: C.textMut },
  previewUnread: { color: C.text, fontWeight: '600' },
  system: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  systemTxt: { flexShrink: 1, fontSize: 13, color: C.greenDark, fontWeight: '600' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: C.orange, alignItems: 'center', justifyContent: 'center' },
  badgeTxt: { fontSize: 11, fontWeight: '800', color: C.white },
  empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: C.text },
  emptyTxt: { fontSize: 13, color: C.textSub, textAlign: 'center', lineHeight: 19 },
  error: { margin: 20, backgroundColor: C.errorBg, borderRadius: 12, padding: 12 },
  errorTxt: { fontSize: 13, color: C.errorText },
  shade: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 28, gap: 6 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  sheetSub: { fontSize: 13, color: C.textSub, marginBottom: 6 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1, borderBottomColor: C.border },
  eventRowTxt: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
  sheetClose: { minHeight: TOUCH, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  sheetCloseTxt: { fontSize: 15, fontWeight: '700', color: C.textSub },
});
