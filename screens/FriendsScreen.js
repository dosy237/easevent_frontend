/**
 * FriendsScreen.js — Easevent (amis)
 * ════════════════════════════════════════════════════════════════
 * Onglets : Mes amis / Demandes (reçues, envoyées) / Ajouter (recherche).
 * Être amis permet de s'inviter en un geste (Inviter › Membres › Mes amis).
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { C, TOUCH } from '../constants/theme';
import { BackButton } from '../components/ui/Buttons';
import friendService from '../services/friendService';
import invitationService from '../services/invitationService';
import { apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';
import { useTicketBadge } from '../context/TicketBadgeContext';

const TABS = [['friends', 'Mes amis'], ['requests', 'Demandes'], ['add', 'Ajouter']];

export default function FriendsScreen({ navigation, route }) {
  const { refresh: refreshBadges } = useTicketBadge();
  const [tab, setTab] = useState(route.params?.tab || 'friends');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState('');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      setData(await friendService.list());
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => () => clearTimeout(timer.current), []);

  const act = async (key, fn) => {
    setBusy(key);
    try { await fn(); await load(); refreshBadges({ force: true }); } catch (err) { showAlert('Action impossible', apiErrorMessage(err)); } finally { setBusy(''); }
  };

  const search = (text) => {
    setQ(text);
    clearTimeout(timer.current);
    if (text.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      try { setResults(await invitationService.searchUsers(text.trim())); } catch { setResults([]); } finally { setSearching(false); }
    }, 400);
  };

  const add = (u) => act(`add-${u.id}`, async () => {
    const r = await friendService.request(u.id);
    setResults((prev) => prev.map((x) => (x.id === u.id ? { ...x, friend_status: r.status === 'accepted' ? 'friend' : 'sent' } : x)));
  });

  const removeFriend = (row) => showAlert('Retirer cet ami', `${row.user.name} ne sera plus dans votre liste d'amis.`, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Retirer', style: 'destructive', onPress: () => act(`rm-${row.id}`, () => friendService.remove(row.id)) },
  ]);

  const incoming = data?.incoming || [];
  const outgoing = data?.outgoing || [];
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Profile'));

  const Person = ({ user, sub, children }) => (
    <View style={styles.row}>
      <View style={styles.avatar}><Text style={styles.avatarTxt}>{user.initials}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>{user.name || `${user.first_name} ${user.last_name}`}</Text>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
      {children}
    </View>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.head}>
          <View style={styles.headRow}>
            <BackButton variant="square" onPress={goBack} />
            <Text style={styles.h1} accessibilityRole="header">Mes amis</Text>
            <View style={{ width: 44 }} />
          </View>
          <View style={styles.tabs} accessibilityRole="tablist">
            {TABS.map(([id, label]) => {
              const on = tab === id;
              const n = id === 'friends' ? data?.friends.length : id === 'requests' ? incoming.length : 0;
              return (
                <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, on && styles.tabOn]}
                  accessibilityRole="tab" accessibilityState={{ selected: on }}>
                  <Text style={[styles.tabTxt, on && styles.tabTxtOn]}>{label}{n ? ` · ${n}` : ''}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.green} colors={[C.green]} />}>
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          {!data && !error ? <ActivityIndicator color={C.green} style={{ marginTop: 32 }} /> : null}

          {data && tab === 'friends' && (
            data.friends.length ? data.friends.map((row) => (
              <Person key={row.id} user={row.user} sub="Ami · invitable en un geste">
                <Pressable onPress={() => removeFriend(row)} style={styles.iconBtn} accessibilityRole="button"
                  accessibilityLabel={`Retirer ${row.user.name}`}>
                  {busy === `rm-${row.id}` ? <ActivityIndicator size="small" color={C.textSub} /> : <Ionicons name="person-remove-outline" size={18} color={C.textSub} />}
                </Pressable>
              </Person>
            )) : (
              <Empty icon="people-outline" title="Pas encore d'amis" text="Ajoutez des membres Easevent : vous pourrez ensuite les inviter à vos événements en un geste."
                cta="Ajouter des amis" onCta={() => setTab('add')} />
            )
          )}

          {data && tab === 'requests' && (
            <>
              <Text style={styles.section}>Reçues</Text>
              {incoming.length ? incoming.map((row) => (
                <Person key={row.id} user={row.user} sub="Vous a envoyé une demande">
                  <Pressable onPress={() => act(`ok-${row.id}`, () => friendService.accept(row.id))} style={[styles.pill, styles.pillOk]} accessibilityRole="button">
                    {busy === `ok-${row.id}` ? <ActivityIndicator size="small" color={C.white} /> : <Text style={styles.pillOkTxt}>Accepter</Text>}
                  </Pressable>
                  <Pressable onPress={() => act(`no-${row.id}`, () => friendService.remove(row.id))} style={styles.iconBtn}
                    accessibilityRole="button" accessibilityLabel={`Refuser la demande de ${row.user.name}`}>
                    <Ionicons name="close" size={20} color={C.textSub} />
                  </Pressable>
                </Person>
              )) : <Text style={styles.none}>Aucune demande reçue.</Text>}
              <Text style={styles.section}>Envoyées</Text>
              {outgoing.length ? outgoing.map((row) => (
                <Person key={row.id} user={row.user} sub="En attente de réponse">
                  <Pressable onPress={() => act(`cx-${row.id}`, () => friendService.remove(row.id))} style={styles.pill} accessibilityRole="button">
                    <Text style={styles.pillTxt}>Annuler</Text>
                  </Pressable>
                </Person>
              )) : <Text style={styles.none}>Aucune demande envoyée.</Text>}
            </>
          )}

          {tab === 'add' && (
            <>
              <View style={styles.search}>
                <Ionicons name="search-outline" size={18} color={C.textMut} />
                <TextInput style={styles.searchInput} value={q} onChangeText={search} placeholder="Nom ou prénom d'un membre"
                  placeholderTextColor={C.textFaint} autoCorrect={false} accessibilityLabel="Rechercher un membre" autoFocus />
                {searching && <ActivityIndicator size="small" color={C.green} />}
              </View>
              {q.trim().length >= 2 && !searching && results.length === 0 && <Text style={styles.none}>Aucun membre trouvé.</Text>}
              {results.map((u) => (
                <Person key={u.id} user={u} sub={u.friend_status === 'friend' ? 'Déjà ami' : u.friend_status === 'sent' ? 'Demande envoyée' : u.friend_status === 'received' ? 'Vous a envoyé une demande' : 'Membre Easevent'}>
                  {!u.friend_status || u.friend_status === 'received' ? (
                    <Pressable onPress={() => add(u)} style={[styles.pill, styles.pillOk]} accessibilityRole="button"
                      accessibilityLabel={`${u.friend_status === 'received' ? 'Accepter' : 'Ajouter'} ${u.first_name} en ami`}>
                      {busy === `add-${u.id}` ? <ActivityIndicator size="small" color={C.white} /> : (
                        <Text style={styles.pillOkTxt}>{u.friend_status === 'received' ? 'Accepter' : 'Ajouter'}</Text>
                      )}
                    </Pressable>
                  ) : <Ionicons name={u.friend_status === 'friend' ? 'checkmark-circle' : 'time-outline'} size={20} color={C.green} />}
                </Person>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Empty({ icon, title, text, cta, onCta }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={C.green} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyTxt}>{text}</Text>
      {cta ? (
        <Pressable onPress={onCta} style={[styles.pill, styles.pillOk, { marginTop: 8, paddingHorizontal: 20 }]} accessibilityRole="button">
          <Text style={styles.pillOkTxt}>{cta}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  head: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { fontSize: 20, fontWeight: '900', color: C.text },
  tabs: { flexDirection: 'row', gap: 8 },
  tab: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: C.green, borderColor: C.green },
  tabTxt: { fontSize: 13, fontWeight: '700', color: C.textSub },
  tabTxtOn: { color: C.white },
  scroll: { padding: 20, gap: 4, width: '100%', maxWidth: 560, alignSelf: 'center' },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: C.textMut, marginTop: 12, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, borderBottomWidth: 1, borderBottomColor: '#F2F2F2' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '800', color: C.green },
  name: { fontSize: 15, fontWeight: '700', color: C.text },
  sub: { fontSize: 12, color: C.textSub, marginTop: 2 },
  iconBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  pill: { minHeight: 38, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  pillTxt: { fontSize: 13, fontWeight: '700', color: C.text },
  pillOk: { backgroundColor: C.green, borderColor: C.green },
  pillOkTxt: { fontSize: 13, fontWeight: '800', color: C.white },
  none: { fontSize: 14, color: C.textSub, marginVertical: 8 },
  search: { minHeight: 46, borderRadius: 14, backgroundColor: C.bg, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 10 },
  error: { fontSize: 13, color: C.errorText },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: C.text },
  emptyTxt: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12 },
});
