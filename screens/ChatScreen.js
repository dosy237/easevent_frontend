/**
 * ChatScreen.js — Easevent (M16 « Conversation »)
 * ════════════════════════════════════════════════════════════════
 * Paramètres : conversationId, ou eventId (+ participantId côté
 * organisateur) pour créer / retrouver la conversation.
 *
 * - Carte de l'événement (statut de l'invité), messages système
 *   (invitation envoyée / acceptée / déclinée, ticket généré), bulles,
 *   accusés de lecture, « en train d'écrire », réponses rapides.
 * - Mise à jour toutes les 4 s tant que l'écran est ouvert et l'app au
 *   premier plan (seuls les nouveaux messages sont téléchargés).
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, AppState, FlatList, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { C, TOUCH } from '../constants/theme';
import { BackButton } from '../components/ui/Buttons';
import LoadingMessages from '../components/ui/LoadingMessages';
import messageService from '../services/messageService';
import { apiErrorMessage } from '../services/authService';
import { useTicketBadge } from '../context/TicketBadgeContext';

const POLL_MS = 4000;
const TYPING_EVERY = 3000;
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const shortDay = (d) => `${d.getDate()} ${MOIS[d.getMonth()]}`;

function dayLabel(iso) {
  const d = new Date(iso);
  const t = new Date();
  if (d.toDateString() === t.toDateString()) return "Aujourd'hui";
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Hier';
  return `${JOURS[d.getDay()]} ${shortDay(d)}`;
}

const STATUS = {
  confirmed:      { label: 'Confirmée', icon: 'checkmark', fg: C.green, bg: C.greenLight },
  to_validate:    { label: 'Ticket à valider', icon: 'ticket-outline', fg: C.green, bg: C.greenLight },
  opened:         { label: 'Invitation vue', icon: 'eye-outline', fg: '#3B4BA8', bg: '#EEF1FD' },
  invited:        { label: 'Invitée', icon: 'mail-outline', fg: '#B4492E', bg: C.orangeL },
  declined:       { label: 'Déclinée', icon: 'close', fg: C.errorText, bg: C.errorBg },
  expired:        { label: 'Expirée', icon: 'time-outline', fg: C.textSub, bg: '#F1F1F1' },
  ticket_pending: { label: 'Ticket en attente', icon: 'ticket-outline', fg: '#B4492E', bg: C.orangeL },
  contact:        { label: 'Contact', icon: 'chatbubble-outline', fg: C.textSub, bg: '#F1F1F1' },
};

export default function ChatScreen({ navigation, route }) {
  const { conversationId: paramId, eventId, participantId } = route.params || {};
  const { refresh: refreshBadges } = useTicketBadge();
  const [convId, setConvId] = useState(paramId || null);
  const [head, setHead] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [otherReadAt, setOtherReadAt] = useState(null);
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [loadingOlder, setLoadingOlder] = useState(false);
  const list = useRef(null);
  const lastTyping = useRef(0);
  const appActive = useRef(AppState.currentState === 'active');

  // 1. Conversation : ouverte par id, ou créée / retrouvée depuis l'événement
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const id = paramId || (await messageService.open(eventId, participantId)).id;
        if (!alive) return;
        setConvId(id);
        setHead(await messageService.detail(id));
      } catch (err) {
        if (alive) setError(apiErrorMessage(err, 'Cette conversation est indisponible.'));
      }
    })();
    return () => { alive = false; };
  }, [paramId, eventId, participantId]);

  const applyMeta = (res) => {
    setOtherReadAt(res.other_read_at);
    setTyping(res.other_typing);
    setOnline(res.other_online);
  };

  // 2. Chargement initial puis nouveaux messages seulement
  const poll = useCallback(async (initial = false) => {
    if (!convId) return;
    try {
      const last = messages.filter((m) => !m.pending)[messages.filter((m) => !m.pending).length - 1];
      const res = await messageService.messages(convId, initial || !last ? {} : { after: last.created_at });
      applyMeta(res);
      if (initial || !last) {
        setMessages(res.results);
        setHasMore(res.has_more);
      } else if (res.results.length) {
        setMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          return [...prev.filter((m) => !m.pending), ...res.results.filter((m) => !known.has(m.id)), ...prev.filter((m) => m.pending)];
        });
      }
      if (initial) refreshBadges({ force: true });
    } catch (err) {
      if (initial) setError(apiErrorMessage(err));
    }
  }, [convId, messages, refreshBadges]);

  const pollRef = useRef(poll);
  pollRef.current = poll;

  useFocusEffect(useCallback(() => {
    if (!convId) return undefined;
    pollRef.current(true);
    const timer = setInterval(() => { if (appActive.current) pollRef.current(false); }, POLL_MS);
    const sub = AppState.addEventListener('change', (s) => { appActive.current = s === 'active'; });
    return () => { clearInterval(timer); sub.remove(); refreshBadges({ force: true }); };
  }, [convId, refreshBadges]));

  const loadOlder = async () => {
    const first = messages.find((m) => !m.pending);
    if (!first) return;
    setLoadingOlder(true);
    try {
      const res = await messageService.messages(convId, { before: first.created_at });
      setMessages((prev) => [...res.results, ...prev]);
      setHasMore(res.has_more);
    } finally {
      setLoadingOlder(false);
    }
  };

  const onType = (value) => {
    setText(value);
    const now = Date.now();
    if (convId && value.trim() && now - lastTyping.current > TYPING_EVERY) {
      lastTyping.current = now;
      messageService.typing(convId).catch(() => {});
    }
  };

  const send = async (body = text) => {
    const clean = body.trim();
    if (!clean || !convId) return;
    const temp = { id: `tmp-${Date.now()}`, kind: 'text', body: clean, from_me: true, created_at: new Date().toISOString(), pending: true };
    setMessages((prev) => [...prev, temp]);
    if (body === text) setText('');
    try {
      const saved = await messageService.send(convId, clean);
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? saved : m)));
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: apiErrorMessage(err) } : m)));
    }
  };

  const retry = (m) => { setMessages((prev) => prev.filter((x) => x.id !== m.id)); send(m.body); };

  const role = head?.role;
  const other = head?.other;
  const ev = head?.event;
  const status = STATUS[head?.guest_status] || STATUS.contact;

  const openEvent = () => {
    if (!ev) return;
    if (role === 'organizer') navigation.navigate('TabDashboard', { screen: 'EventDashboard', params: { event: { id: ev.id, title: ev.title } } });
    else navigation.navigate('TabDiscover', { screen: 'EventDetail', params: { event: { id: ev.id, title: ev.title } } });
  };

  const quickReplies = role === 'organizer'
    ? [
      ...(ev?.location_address ? [["Envoyer l'itinéraire", `Voici l'itinéraire : https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location_address)}`]] : []),
      ['Merci pour votre réponse', 'Merci pour votre réponse, à très bientôt !'],
      ['Où trouver son ticket', "Votre ticket est dans l'application Easevent, onglet « Tickets » : présentez le QR code à l'entrée."],
    ]
    : [
      ['Je serai là', 'Je serai là, merci pour l’invitation !'],
      ['Parking ?', 'Bonjour ! Est-ce qu’il y a un parking sur place ?'],
      ['Venir accompagné(e) ?', 'Est-ce que je peux venir accompagné(e) ?'],
    ];

  // Messages + séparateurs de jour
  const rows = [];
  let lastDay = '';
  messages.forEach((m) => {
    const day = dayLabel(m.created_at);
    if (day !== lastDay) { rows.push({ id: `day-${m.id}`, kind: 'day', label: day }); lastDay = day; }
    rows.push(m);
  });
  const readUntil = otherReadAt ? new Date(otherReadAt) : null;
  const isRead = (m) => !!readUntil && readUntil >= new Date(m.created_at);

  const renderRow = ({ item: m }) => {
    if (m.kind === 'day') return <Text style={styles.day} accessibilityRole="header">{m.label}</Text>;
    if (m.kind === 'system') {
      const d = new Date(m.created_at);
      const name = role === 'organizer' ? other?.first_name : 'Vous';
      const labels = {
        invitation_sent: `Invitation envoyée · ${shortDay(d)}`,
        invitation_accepted: `${name} ${role === 'organizer' ? 'a' : 'avez'} accepté l'invitation · ${shortDay(d)}`,
        invitation_declined: `${name} ${role === 'organizer' ? 'a' : 'avez'} décliné l'invitation · ${shortDay(d)}`,
        ticket_generated: `Ticket généré · ${shortDay(d)}`,
      };
      const positive = ['invitation_accepted', 'ticket_generated'].includes(m.system_type);
      return (
        <View style={[styles.system, positive && styles.systemOk]} accessibilityRole="text">
          {positive && <Ionicons name="checkmark-circle" size={14} color={C.green} />}
          <Text style={[styles.systemTxt, positive && { color: C.greenDark, fontWeight: '700' }]}>{labels[m.system_type] || m.system_type}</Text>
        </View>
      );
    }
    const mine = m.from_me;
    const d = new Date(m.created_at);
    return (
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs, m.failed && styles.failed]}
        accessible accessibilityLabel={`${mine ? 'Vous' : other?.first_name || ''} : ${m.body}, ${hhmm(d)}${m.failed ? ', non envoyé' : ''}`}>
        <Text style={[styles.body, mine && { color: C.white }]} selectable>{m.body}</Text>
        <View style={styles.meta}>
          <Text style={[styles.metaTxt, mine && { color: 'rgba(255,255,255,0.75)' }]}>{m.pending ? 'Envoi…' : hhmm(d)}</Text>
          {mine && !m.pending && !m.failed && (
            <Ionicons name={isRead(m) ? 'checkmark-done' : 'checkmark'} size={14} color="#C5E8D3"
              accessibilityLabel={isRead(m) ? 'Lu' : 'Envoyé'} />
          )}
        </View>
        {m.failed && (
          <Pressable onPress={() => retry(m)} accessibilityRole="button" style={styles.retry}>
            <Ionicons name="alert-circle" size={14} color={C.white} />
            <Text style={styles.retryTxt}>Non envoyé — réessayer</Text>
          </Pressable>
        )}
      </View>
    );
  };

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabDashboard', { screen: 'Conversations' }));

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <BackButton variant="square" onPress={goBack} />
          <View>
            <View style={styles.avatar}><Text style={styles.avatarTxt}>{other?.initials || ''}</Text></View>
            {online && <View style={styles.online} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1} accessibilityRole="header">{other?.name || route.params?.title || 'Conversation'}</Text>
            <Text style={[styles.presence, online && { color: C.green }]} numberOfLines={1}>
              {typing ? "En train d'écrire…" : online ? 'En ligne' : role === 'participant' ? 'Organisateur' : ev?.title || ''}
            </Text>
          </View>
          <Pressable onPress={openEvent} style={styles.info} accessibilityRole="button"
            accessibilityLabel={role === 'organizer' ? "Gérer l'événement" : "Voir l'événement"}>
            <Ionicons name="information-circle-outline" size={24} color={C.text} />
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox} accessibilityRole="alert"><Text style={styles.errorTxt}>{error}</Text></View>
        ) : !head ? (
          <View style={styles.loading}><ActivityIndicator color={C.green} /><LoadingMessages messages={['Nous ouvrons la conversation…', 'Encore un instant…']} /></View>
        ) : (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <Pressable onPress={openEvent} style={styles.card} accessibilityRole="button" accessibilityLabel={`${ev.title}. ${status.label}`}>
              {ev.cover_image ? <Image source={{ uri: ev.cover_image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
              <View style={styles.cardShade} />
              <View style={styles.glass}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{ev.title}</Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {`${JOURS[new Date(ev.start_date).getDay()]} ${shortDay(new Date(ev.start_date))} · ${hhmm(new Date(ev.start_date))}`}
                    {ev.is_online ? ' · En ligne' : ev.location_address ? ` · ${ev.location_address}` : ''}
                  </Text>
                </View>
                <View style={[styles.status, { backgroundColor: status.bg }]}>
                  <Ionicons name={status.icon} size={11} color={status.fg} />
                  <Text style={[styles.statusTxt, { color: status.fg }]}>{status.label}</Text>
                </View>
              </View>
            </Pressable>

            <FlatList
              ref={list}
              data={rows}
              keyExtractor={(m) => m.id}
              renderItem={renderRow}
              contentContainerStyle={styles.thread}
              onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
              accessibilityLiveRegion="polite"
              ListHeaderComponent={hasMore ? (
                <Pressable onPress={loadOlder} style={styles.older} accessibilityRole="button">
                  {loadingOlder ? <ActivityIndicator size="small" color={C.green} /> : <Text style={styles.olderTxt}>Messages précédents</Text>}
                </Pressable>
              ) : null}
              ListEmptyComponent={<Text style={styles.emptyTxt}>Écrivez le premier message.</Text>}
              ListFooterComponent={typing ? (
                <View style={styles.typing} accessibilityLabel={`${other?.first_name || ''} est en train d'écrire`}>
                  <View style={[styles.dot, { backgroundColor: '#9E9E9E' }]} />
                  <View style={[styles.dot, { backgroundColor: '#BDBDBD' }]} />
                  <View style={[styles.dot, { backgroundColor: '#DADADA' }]} />
                </View>
              ) : null}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickBar} contentContainerStyle={styles.quick} keyboardShouldPersistTaps="handled">
              {quickReplies.map(([label, body]) => (
                <Pressable key={label} onPress={() => send(body)} style={styles.quickBtn} accessibilityRole="button"
                  accessibilityHint="Envoie ce message">
                  <Text style={styles.quickTxt}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.composer}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={onType}
                placeholder="Votre message…"
                placeholderTextColor={C.textFaint}
                multiline
                maxLength={2000}
                accessibilityLabel="Votre message"
              />
              <Pressable onPress={() => send()} disabled={!text.trim()} style={[styles.sendBtn, !text.trim() && { opacity: 0.5 }]}
                accessibilityRole="button" accessibilityLabel="Envoyer" accessibilityState={{ disabled: !text.trim() }}>
                <Ionicons name="paper-plane-outline" size={18} color={C.white} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '800', color: C.green },
  online: { position: 'absolute', right: 0, bottom: 0, width: 11, height: 11, borderRadius: 6, backgroundColor: '#2ECC71', borderWidth: 2, borderColor: C.white },
  name: { fontSize: 16, fontWeight: '800', color: C.text },
  presence: { fontSize: 12, color: C.textMut, fontWeight: '600' },
  info: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  errorBox: { margin: 16, backgroundColor: C.errorBg, borderRadius: 12, padding: 12 },
  errorTxt: { fontSize: 13, color: C.errorText },
  card: { marginHorizontal: 16, marginTop: 12, borderRadius: 16, overflow: 'hidden', padding: 10, backgroundColor: C.green },
  cardShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,30,20,0.55)' },
  glass: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.32)' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: C.white },
  cardMeta: { fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusTxt: { fontSize: 11, fontWeight: '800' },
  thread: { paddingHorizontal: 16, paddingVertical: 14, gap: 10, flexGrow: 1 },
  day: { alignSelf: 'center', fontSize: 12, fontWeight: '700', color: C.textMut, marginVertical: 4 },
  system: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  systemOk: { backgroundColor: C.greenLight, borderColor: C.greenSoft },
  systemTxt: { fontSize: 12, color: C.textMut },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { alignSelf: 'flex-end', backgroundColor: C.green, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
  failed: { backgroundColor: '#B23B3B' },
  body: { fontSize: 14, lineHeight: 20, color: C.text },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  metaTxt: { fontSize: 11, color: C.textMut },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  retryTxt: { fontSize: 12, fontWeight: '700', color: C.white, textDecorationLine: 'underline' },
  typing: { alignSelf: 'flex-start', flexDirection: 'row', gap: 4, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  older: { alignSelf: 'center', minHeight: 36, justifyContent: 'center', marginBottom: 6 },
  olderTxt: { fontSize: 13, fontWeight: '700', color: C.green },
  emptyTxt: { alignSelf: 'center', fontSize: 13, color: C.textMut, marginTop: 20 },
  quickBar: { flexGrow: 0, flexShrink: 0 },
  quick: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, alignItems: 'center' },
  quickBtn: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 100, borderWidth: 1.5, borderColor: C.greenSoft, backgroundColor: C.white },
  quickTxt: { fontSize: 13, fontWeight: '600', color: C.green },
  composer: { backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 24, flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.inputBg, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontSize: 15, color: C.text },
  sendBtn: { width: TOUCH, height: TOUCH, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
});
