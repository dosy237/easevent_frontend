/**
 * screens/EventTeamScreen.js — cogestion d'un événement
 * ════════════════════════════════════════════════════════════════
 * - Co-organisateurs : gèrent l'événement avec vous (invités, accueil, souvenirs…)
 * - Photographes : ajoutent des photos à l'espace souvenirs, rien d'autre
 * - Répartition des invités (si un nombre d'invités est indiqué) : une part
 *   proposée à chacun, modifiable à tout moment par l'organisateur
 * - « Écrire » : conversation directe entre organisateurs pour s'accorder
 * params : { event }
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { BackButton, PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { C, TOUCH } from '../constants/theme';
import invitationService from '../services/invitationService';
import messageService from '../services/messageService';
import teamService from '../services/teamService';
import { apiErrorMessage } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { showAlert } from '../utils/dialog';

const ROLE = {
  organizer:    { label: 'Organisateur',    icon: 'star',           color: C.orange },
  cohost:       { label: 'Co-organisateur', icon: 'people',         color: C.green },
  photographer: { label: 'Photographe',     icon: 'camera',         color: C.blue },
};

export default function EventTeamScreen({ route, navigation }) {
  const event = route?.params?.event || {};
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(null);         // null | 'cohost' | 'photographer'
  const [query, setQuery] = useState('');
  const [found, setFound] = useState([]);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState({});             // parts en cours de saisie
  const [saving, setSaving] = useState(false);
  const timer = useRef(null);
  const { user } = useAuth();
  const me = user?.id ? String(user.id) : null;

  const load = useCallback(async () => {
    try {
      const d = await teamService.team(event.id);
      setData(d);
      setDraft(Object.fromEntries(Object.entries(d.split || {}).map(([k, v]) => [k, String(v)])));
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err, "L'équipe n'a pas pu être chargée."));
    }
  }, [event.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    clearTimeout(timer.current);
    if (query.trim().length < 2) { setFound([]); return undefined; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try { setFound(await invitationService.searchUsers(query.trim())); }
      catch { setFound([]); }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [query]);

  const isOrganizer = data?.my_role === 'organizer';
  const memberIds = new Set((data?.members || []).map((m) => m.user_id));

  const add = async (person) => {
    try {
      const d = await teamService.addMember(event.id, person.id, adding);
      setData(d);
      setAdding(null); setQuery(''); setFound([]);
      showAlert('Proposition envoyée',
        `${person.first_name} reçoit une notification et doit accepter pour ${adding === 'cohost' ? 'co-organiser l’événement' : 'ajouter des photos'}.`);
    } catch (err) {
      showAlert('Ajout impossible', apiErrorMessage(err));
    }
  };

  const remove = (m) => {
    const self = m.user_id === me;
    showAlert(self ? "Quitter l'équipe ?" : `Retirer ${m.name} ?`,
      self ? "Vous ne pourrez plus gérer cet événement." : `${m.name} ne pourra plus ${m.role === 'cohost' ? 'gérer l’événement' : 'ajouter de photos'}.`,
      [{ text: 'Annuler', style: 'cancel' }, {
        text: self ? 'Quitter' : 'Retirer', style: 'destructive', onPress: async () => {
          try {
            await teamService.removeMember(event.id, m.id);
            if (self) navigation.navigate('Dashboard'); else load();
          } catch (err) { showAlert('Action impossible', apiErrorMessage(err)); }
        },
      }]);
  };

  const write = async (m) => {
    try {
      const conv = await messageService.openDirect(m.user_id);
      navigation.navigate('Chat', { conversationId: conv.id, title: m.name });
    } catch (err) { showAlert('Conversation impossible', apiErrorMessage(err)); }
  };

  const saveSplit = async (proposed = false) => {
    setSaving(true);
    try {
      const split = proposed ? 'proposed'
        : Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]));
      const d = await teamService.setSplit(event.id, split);
      setData(d);
      setDraft(Object.fromEntries(Object.entries(d.split || {}).map(([k, v]) => [k, String(v)])));
      showAlert('Répartition enregistrée', 'Chacun peut inviter dans sa part. Vous pouvez la changer à tout moment.');
    } catch (err) {
      showAlert('Répartition refusée', apiErrorMessage(err));
    } finally { setSaving(false); }
  };

  const hosts = (data?.members || []).filter((m) => m.role !== 'photographer' && m.status === 'accepted');
  const draftTotal = Object.values(draft).reduce((s, v) => s + (Number(v) || 0), 0);

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} accessibilityRole="header">Équipe</Text>
          <Text style={s.sub} numberOfLines={1}>{event.title}</Text>
        </View>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
          {error ? <Text style={s.error}>{error}</Text> : null}
          {!data && !error ? <ActivityIndicator color={C.green} style={{ marginTop: 40 }} /> : null}
          {data ? (
            <>
              <Text style={s.intro}>
                Les co-organisateurs gèrent l'événement avec vous. Les photographes ajoutent seulement des photos à l'espace souvenirs.
              </Text>

              {/* ── Membres ─────────────────────────────────── */}
              <View style={s.card}>
                {data.members.map((m, i) => {
                  const r = ROLE[m.role];
                  return (
                    <View key={m.user_id} style={[s.member, i === data.members.length - 1 && { borderBottomWidth: 0 }]}>
                      <View style={[s.avatar, { backgroundColor: r.color + '22' }]}>
                        <Text style={[s.avatarTxt, { color: r.color }]}>{m.initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.name} numberOfLines={1}>{m.name}</Text>
                        <View style={s.roleRow}>
                          <Ionicons name={r.icon} size={12} color={r.color} />
                          <Text style={[s.roleTxt, { color: r.color }]}>{r.label}</Text>
                          {m.status === 'pending' ? <Text style={s.pending}>· en attente</Text> : null}
                        </View>
                        {data.max_guests && m.role !== 'photographer' ? (
                          <Text style={s.usage}>{m.used} invité{m.used > 1 ? 's' : ''}{m.quota != null ? ` sur ${m.quota}` : ''}</Text>
                        ) : null}
                      </View>
                      {m.user_id !== me ? (
                        <Pressable style={s.iconBtn} onPress={() => write(m)} accessibilityRole="button" accessibilityLabel={`Écrire à ${m.name}`}>
                          <Ionicons name="chatbubble-ellipses-outline" size={18} color={C.green} />
                        </Pressable>
                      ) : null}
                      {m.id && (isOrganizer || m.user_id === me) ? (
                        <Pressable style={s.iconBtn} onPress={() => remove(m)} accessibilityRole="button"
                          accessibilityLabel={m.user_id === me ? "Quitter l'équipe" : `Retirer ${m.name}`}>
                          <Ionicons name={m.user_id === me ? 'exit-outline' : 'close'} size={18} color={C.error} />
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              {/* ── Ajouter ─────────────────────────────────── */}
              {adding ? (
                <View style={s.card}>
                  <Text style={s.cardTitle}>{adding === 'cohost' ? 'Ajouter un co-organisateur' : 'Ajouter un photographe'}</Text>
                  <TextInput style={s.input} value={query} onChangeText={setQuery} placeholder="Nom d'un membre d'Easevent"
                    placeholderTextColor={C.textMut} autoFocus accessibilityLabel="Rechercher un membre" />
                  {searching ? <ActivityIndicator color={C.green} style={{ marginVertical: 8 }} /> : null}
                  {found.map((u) => (
                    <Pressable key={u.id} style={s.result} onPress={() => add(u)} disabled={memberIds.has(u.id)}
                      accessibilityRole="button" accessibilityLabel={`Ajouter ${u.first_name} ${u.last_name}`}>
                      <View style={s.avatar}><Text style={s.avatarTxt}>{u.initials}</Text></View>
                      <Text style={[s.name, { flex: 1 }]}>{u.first_name} {u.last_name}</Text>
                      <Text style={s.addTxt}>{memberIds.has(u.id) ? 'Déjà dans l’équipe' : 'Ajouter'}</Text>
                    </Pressable>
                  ))}
                  {query.trim().length >= 2 && !searching && !found.length ? <Text style={s.hint}>Aucun membre trouvé.</Text> : null}
                  <SecondaryButton label="Annuler" onPress={() => { setAdding(null); setQuery(''); }} style={{ marginTop: 10 }} />
                </View>
              ) : (
                <View style={{ gap: 10, marginBottom: 16 }}>
                  {isOrganizer ? (
                    <PrimaryButton label="Ajouter un co-organisateur" icon="person-add-outline" onPress={() => setAdding('cohost')} />
                  ) : null}
                  <SecondaryButton label="Ajouter un photographe" icon="camera-outline" onPress={() => setAdding('photographer')} />
                </View>
              )}

              {/* ── Répartition des invités ─────────────────── */}
              <View style={s.card}>
                <Text style={s.cardTitle}>Répartition des invités</Text>
                {!data.max_guests ? (
                  <Text style={s.hint}>
                    Pas de nombre d'invités pour cet événement : chacun invite librement (dans la limite de votre plan).
                    Indiquez un nombre d'invités dans « Modifier » pour répartir les places.
                  </Text>
                ) : hosts.length < 2 ? (
                  <Text style={s.hint}>{data.max_guests} places. Ajoutez un co-organisateur pour partager les invitations.</Text>
                ) : (
                  <>
                    <Text style={s.hint}>
                      {data.max_guests} places · {data.total_used} invitation{data.total_used > 1 ? 's' : ''} envoyée{data.total_used > 1 ? 's' : ''}.
                      {' '}Proposition : {hosts.map((h) => `${h.name.split(' ')[0]} ${data.proposed[h.user_id] ?? 0}`).join(', ')}.
                    </Text>
                    {hosts.map((h) => (
                      <View key={h.user_id} style={s.splitRow}>
                        <Text style={[s.name, { flex: 1 }]} numberOfLines={1}>{h.name}</Text>
                        <Text style={s.usage}>{h.used} envoyée{h.used > 1 ? 's' : ''}</Text>
                        <TextInput style={s.splitInput} value={draft[h.user_id] ?? ''} editable={isOrganizer}
                          onChangeText={(v) => setDraft((d) => ({ ...d, [h.user_id]: v.replace(/[^0-9]/g, '') }))}
                          keyboardType="number-pad" placeholder="—" placeholderTextColor={C.textMut}
                          accessibilityLabel={`Part de ${h.name}`} />
                      </View>
                    ))}
                    {isOrganizer ? (
                      <>
                        <Text style={[s.hint, draftTotal > data.max_guests && { color: C.error }]}>
                          Total : {draftTotal} / {data.max_guests}
                        </Text>
                        <PrimaryButton label="Enregistrer la répartition" onPress={() => saveSplit(false)} loading={saving}
                          disabled={draftTotal > data.max_guests} />
                        <SecondaryButton label="Appliquer la proposition équitable" onPress={() => saveSplit(true)} style={{ marginTop: 8 }} />
                      </>
                    ) : (
                      <Text style={s.hint}>Seul l'organisateur change la répartition : écrivez-lui pour vous mettre d'accord.</Text>
                    )}
                  </>
                )}
              </View>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  sub: { fontSize: 12, color: C.textMut },
  pad: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 13, color: C.textSub, lineHeight: 19, marginBottom: 14 },
  error: { color: C.errorText, marginBottom: 12 },
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 10 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontWeight: '800', color: C.green },
  name: { fontSize: 14, fontWeight: '700', color: C.text },
  roleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  roleTxt: { fontSize: 12, fontWeight: '700' },
  pending: { fontSize: 12, color: C.textMut },
  usage: { fontSize: 12, color: C.textSub, marginTop: 2 },
  iconBtn: { width: TOUCH, height: TOUCH, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 12, minHeight: TOUCH, backgroundColor: C.inputBg, color: C.text },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, minHeight: TOUCH },
  addTxt: { color: C.green, fontWeight: '800' },
  hint: { fontSize: 13, color: C.textSub, lineHeight: 19, marginBottom: 10 },
  splitRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  splitInput: { width: 70, minHeight: TOUCH, borderWidth: 1, borderColor: C.border, borderRadius: 10, textAlign: 'center', fontSize: 16, fontWeight: '800', color: C.text, backgroundColor: C.inputBg },
});
