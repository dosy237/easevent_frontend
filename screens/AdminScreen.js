/**
 * screens/AdminScreen.js — Administration (comptes de l'équipe Easevent)
 * ════════════════════════════════════════════════════════════════
 * 4 onglets :
 *   Aperçu      chiffres clés
 *   Comptes     rechercher, créer (lien pour choisir le mot de passe), modifier le plan,
 *               suspendre, supprimer (RGPD : événements annulés, invités prévenus)
 *   Événements  rechercher, renommer, retirer du fil (brouillon) ou republier,
 *               public / privé, annuler (invités prévenus, paiements remboursés)
 *   Annonces    message de l'équipe en tête du fil de tous, avec vidéo de 45 s,
 *               lien, priorité et durée de diffusion
 * Le serveur revérifie le rôle à chaque appel et trace chaque modification.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { BackButton, PrimaryButton } from '../components/ui/Buttons';
import EventVideo from '../components/events/EventVideo';
import { C, TOUCH } from '../constants/theme';
import adminService from '../services/adminService';
import { useAuth } from '../context/AuthContext';
import { showAlert } from '../utils/dialog';
import { uploadVideo, VIDEO_MAX_SECONDS } from '../utils/videoUpload';

const TABS = [['overview', 'Aperçu'], ['users', 'Comptes'], ['events', 'Événements'], ['news', 'Annonces']];
const PLANS = [['free', 'Gratuit'], ['standard', 'Standard'], ['pro', 'Pro']];
const STATUS = { draft: 'Brouillon', published: 'Publié', live: 'En cours', ended: 'Terminé', souvenir: 'Souvenir', archived: 'Archivé' };
const PRIORITIES = [[10, 'Normale'], [50, 'Haute'], [90, 'Urgente']];
const DURATIONS = [[1, '1 jour'], [7, '7 jours'], [30, '30 jours'], [0, 'Sans fin']];
const errMsg = (err, fallback) => err?.response?.data?.detail || fallback;
const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// ── Briques ─────────────────────────────────────────────────────
function Sheet({ visible, title, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <Text style={styles.sheetTitle} accessibilityRole="header" numberOfLines={2}>{title}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, value, onChangeText, max, multiline, ...rest }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.label}>{max ? `${label} · ${(value || '').length}/${max}` : label}</Text>
      <TextInput value={value} onChangeText={(v) => onChangeText(max ? v.slice(0, max) : v)} multiline={multiline}
        style={[styles.input, multiline && { minHeight: 84, textAlignVertical: 'top' }]} accessibilityLabel={label}
        placeholderTextColor={C.textMut} {...rest} />
    </View>
  );
}

function Chips({ label, options, value, onChange }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {options.map(([id, text]) => {
          const on = value === id;
          return (
            <Pressable key={String(id)} onPress={() => onChange(id)} style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={`${label} : ${text}`}>
              <Text style={[styles.chipTxt, on && styles.chipTxtOn]}>{text}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Danger({ label, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.danger} accessibilityRole="button">
      <Ionicons name="trash-outline" size={18} color={C.errorText} />
      <Text style={styles.dangerTxt}>{label}</Text>
    </Pressable>
  );
}

function SearchBar({ value, onChange, placeholder }) {
  return (
    <View style={styles.search}>
      <Ionicons name="search-outline" size={18} color={C.textMut} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} style={styles.searchInput}
        accessibilityLabel={placeholder} placeholderTextColor={C.textMut} autoCapitalize="none" />
    </View>
  );
}

// Liste paginée avec recherche (comptes, événements)
function usePaged(fetcher, deps) {
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState({ page: 1, has_more: false, total: 0 });
  const [error, setError] = useState(null);
  const seq = useRef(0);
  const load = useCallback(async (page = 1) => {
    const id = ++seq.current;
    try {
      const d = await fetcher(page);
      if (id !== seq.current) return;
      setRows((prev) => (page === 1 ? d.results : [...(prev || []), ...d.results]));
      setMeta(d);
      setError(null);
    } catch (err) {
      if (id === seq.current) setError(errMsg(err, 'Chargement impossible.'));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    const t = setTimeout(() => load(1), 250);
    return () => clearTimeout(t);
  }, [load]);
  const replace = (row) => setRows((prev) => (prev || []).map((r) => (r.id === row.id ? { ...r, ...row } : r)));
  const remove = (id) => { setRows((prev) => (prev || []).filter((r) => r.id !== id)); setMeta((m) => ({ ...m, total: Math.max(0, m.total - 1) })); };
  return { rows, meta, error, load, replace, remove };
}

// ── Aperçu ──────────────────────────────────────────────────────
function Overview() {
  const [s, setS] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { adminService.stats().then(setS).catch((e) => setError(errMsg(e, 'Chargement impossible.'))); }, []);
  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!s) return <ActivityIndicator color={C.green} style={{ marginTop: 30 }} />;
  const cards = [
    ['people-outline', 'Comptes', s.users, `+${s.users_7d} en 7 jours`],
    ['card-outline', 'Abonnés payants', s.paying, `Standard ${s.plans?.standard || 0} · Pro ${s.plans?.pro || 0}`],
    ['calendar-outline', 'Événements', s.events, `${s.events_upcoming} à venir`],
    ['megaphone-outline', 'Publiés', s.events_published, 'visibles par leurs invités'],
    ['ticket-outline', 'Invitations et billets', s.tickets, 'en cours de validité'],
    ['radio-outline', 'Annonces en cours', s.announcements_live, s.suspended ? `${s.suspended} compte(s) suspendu(s)` : 'aucun compte suspendu'],
  ];
  return (
    <ScrollView contentContainerStyle={styles.grid}>
      {cards.map(([icon, label, n, sub]) => (
        <View key={label} style={styles.stat} accessible accessibilityLabel={`${label} : ${n}. ${sub}`}>
          <Ionicons name={icon} size={20} color={C.green} />
          <Text style={styles.statN}>{n}</Text>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={styles.statSub}>{sub}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

// ── Comptes ─────────────────────────────────────────────────────
function Users({ me }) {
  const [q, setQ] = useState('');
  const list = usePaged((page) => adminService.users(q.trim(), page), [q]);
  const [edit, setEdit] = useState(null);
  const [create, setCreate] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const body = { first_name: edit.first_name, last_name: edit.last_name, plan: edit.plan, is_active: edit.is_active };
      if (me?.is_superuser) body.is_staff = edit.is_staff;
      list.replace(await adminService.updateUser(edit.id, body));
      setEdit(null);
    } catch (err) {
      showAlert('Modification impossible', errMsg(err, 'Réessayez.'));
    } finally { setBusy(false); }
  };
  const destroy = () => showAlert('Supprimer ce compte ?',
    `${edit.email}\nSes données personnelles sont effacées, ses événements à venir annulés (invités prévenus, paiements remboursés). Action définitive.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try { await adminService.deleteUser(edit.id); list.remove(edit.id); setEdit(null); } catch (err) { showAlert('Suppression impossible', errMsg(err, 'Réessayez.')); }
      } },
    ]);
  const add = async () => {
    setBusy(true);
    try {
      const row = await adminService.createUser(create);
      setCreate(null);
      list.load(1);
      showAlert('Compte créé', `${row.email} a reçu un lien pour choisir son mot de passe.`);
    } catch (err) {
      showAlert('Création impossible', errMsg(err, 'Réessayez.'));
    } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.toolbar}>
        <SearchBar value={q} onChange={setQ} placeholder="Nom ou email" />
        <Pressable onPress={() => setCreate({ email: '', first_name: '', last_name: '' })} style={styles.addBtn}
          accessibilityRole="button" accessibilityLabel="Ajouter un compte">
          <Ionicons name="person-add-outline" size={20} color={C.white} />
        </Pressable>
      </View>
      {list.error ? <Text style={styles.error}>{list.error}</Text> : null}
      {list.rows === null ? <ActivityIndicator color={C.green} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={list.rows}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListHeaderComponent={<Text style={styles.count}>{`${list.meta.total} compte${list.meta.total > 1 ? 's' : ''}`}</Text>}
          ListEmptyComponent={<Text style={styles.empty}>Aucun compte ne correspond.</Text>}
          onEndReached={() => list.meta.has_more && list.load(list.meta.page + 1)}
          renderItem={({ item: u }) => (
            <Pressable onPress={() => setEdit({ ...u })} style={styles.row} accessibilityRole="button"
              accessibilityLabel={`${u.first_name} ${u.last_name}, ${u.email}, plan ${u.plan}${u.is_active ? '' : ', suspendu'}`}>
              <View style={styles.avatar}><Text style={styles.avatarTxt}>{`${u.first_name[0] || ''}${u.last_name[0] || ''}`.toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{`${u.first_name} ${u.last_name}`}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>{u.email}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[styles.tag, u.plan !== 'free' && styles.tagPaid]}>{PLANS.find(([id]) => id === u.plan)?.[1] || u.plan}</Text>
                {!u.is_active ? <Text style={[styles.tag, styles.tagOff]}>Suspendu</Text> : u.is_staff ? <Text style={styles.tag}>Admin</Text> : null}
              </View>
            </Pressable>
          )}
        />
      )}

      <Sheet visible={!!edit} title={edit ? `${edit.first_name} ${edit.last_name}` : ''} onClose={() => setEdit(null)}>
        {edit ? (
          <>
            <Text style={styles.meta}>{`${edit.email} · inscrit le ${shortDate(edit.created_at)} · ${edit.events ?? 0} événement(s)`}</Text>
            <Field label="Prénom" value={edit.first_name} max={50} onChangeText={(v) => setEdit({ ...edit, first_name: v })} />
            <Field label="Nom" value={edit.last_name} max={50} onChangeText={(v) => setEdit({ ...edit, last_name: v })} />
            <Chips label="Plan" options={PLANS} value={edit.plan} onChange={(plan) => setEdit({ ...edit, plan })} />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Compte actif</Text>
              <Switch value={edit.is_active} onValueChange={(v) => setEdit({ ...edit, is_active: v })} trackColor={{ true: C.green }}
                accessibilityLabel="Compte actif (désactivé : suspendu et déconnecté)" />
            </View>
            {me?.is_superuser ? (
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Administrateur</Text>
                <Switch value={edit.is_staff} onValueChange={(v) => setEdit({ ...edit, is_staff: v })} trackColor={{ true: C.green }}
                  accessibilityLabel="Administrateur" />
              </View>
            ) : null}
            <PrimaryButton label="Enregistrer" loading={busy} onPress={save} style={{ marginTop: 18 }} />
            <Danger label="Supprimer le compte" onPress={destroy} />
          </>
        ) : null}
      </Sheet>

      <Sheet visible={!!create} title="Ajouter un compte" onClose={() => setCreate(null)}>
        {create ? (
          <>
            <Text style={styles.meta}>La personne reçoit un email pour choisir son mot de passe.</Text>
            <Field label="Email" value={create.email} onChangeText={(v) => setCreate({ ...create, email: v.trim() })} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Prénom" value={create.first_name} max={50} onChangeText={(v) => setCreate({ ...create, first_name: v })} />
            <Field label="Nom" value={create.last_name} max={50} onChangeText={(v) => setCreate({ ...create, last_name: v })} />
            <PrimaryButton label="Créer le compte" loading={busy} onPress={add} style={{ marginTop: 18 }}
              disabled={!create.email || !create.first_name.trim() || !create.last_name.trim()} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

// ── Événements ──────────────────────────────────────────────────
function Events({ navigation }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const list = usePaged((page) => adminService.events(q.trim(), page, status), [q, status]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      list.replace(await adminService.updateEvent(edit.id, { title: edit.title, status: edit.status, visibility: edit.visibility }));
      setEdit(null);
    } catch (err) {
      showAlert('Modification impossible', errMsg(err, 'Réessayez.'));
    } finally { setBusy(false); }
  };
  const cancel = () => showAlert('Annuler cet événement ?',
    `« ${edit.title} »\nLes participants sont prévenus et les paiements remboursés. Action définitive.`, [
      { text: 'Retour', style: 'cancel' },
      { text: "Annuler l'événement", style: 'destructive', onPress: async () => {
        try {
          const r = await adminService.deleteEvent(edit.id);
          list.remove(edit.id);
          setEdit(null);
          showAlert('Événement annulé', `${r.notified} participant(s) prévenu(s).${r.refunds_failed ? ` ${r.refunds_failed} remboursement(s) à vérifier dans Stripe.` : ''}`);
        } catch (err) { showAlert('Annulation impossible', errMsg(err, 'Réessayez.')); }
      } },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.toolbar}><SearchBar value={q} onChange={setQ} placeholder="Titre ou email de l'organisateur" /></View>
      <View style={[styles.chips, { paddingHorizontal: 16 }]}>
        {[['', 'Tous'], ['published', 'Publiés'], ['draft', 'Brouillons']].map(([id, text]) => (
          <Pressable key={id || 'all'} onPress={() => setStatus(id)} style={[styles.chip, status === id && styles.chipOn]}
            accessibilityRole="radio" accessibilityState={{ checked: status === id }} aria-checked={status === id}>
            <Text style={[styles.chipTxt, status === id && styles.chipTxtOn]}>{text}</Text>
          </Pressable>
        ))}
      </View>
      {list.error ? <Text style={styles.error}>{list.error}</Text> : null}
      {list.rows === null ? <ActivityIndicator color={C.green} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={list.rows}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListHeaderComponent={<Text style={styles.count}>{`${list.meta.total} événement${list.meta.total > 1 ? 's' : ''}`}</Text>}
          ListEmptyComponent={<Text style={styles.empty}>Aucun événement ne correspond.</Text>}
          onEndReached={() => list.meta.has_more && list.load(list.meta.page + 1)}
          renderItem={({ item: e }) => (
            <Pressable onPress={() => setEdit({ ...e })} style={styles.row} accessibilityRole="button"
              accessibilityLabel={`${e.title}, par ${e.organizer.name}, ${STATUS[e.status] || e.status}`}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{e.title}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>{`${e.organizer.name} · ${shortDate(e.start_date)} · ${e.participants ?? 0} participant(s)`}</Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={[styles.tag, e.status === 'published' && styles.tagPaid]}>{STATUS[e.status] || e.status}</Text>
                <Text style={styles.tag}>{e.visibility === 'public' ? 'Public' : 'Privé'}</Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <Sheet visible={!!edit} title={edit?.title || ''} onClose={() => setEdit(null)}>
        {edit ? (
          <>
            <Text style={styles.meta}>{`Par ${edit.organizer.name} (${edit.organizer.email}) · ${shortDate(edit.start_date)}`}</Text>
            <Field label="Titre" value={edit.title} max={200} onChangeText={(v) => setEdit({ ...edit, title: v })} />
            <Chips label="Publication" options={[['published', 'Publié'], ['draft', 'Retiré (brouillon)']]}
              value={edit.status === 'published' ? 'published' : edit.status === 'draft' ? 'draft' : null}
              onChange={(s) => setEdit({ ...edit, status: s })} />
            <Chips label="Visibilité" options={[['public', 'Public'], ['private', 'Privé']]} value={edit.visibility}
              onChange={(v) => setEdit({ ...edit, visibility: v })} />
            <PrimaryButton label="Enregistrer" loading={busy} onPress={save} style={{ marginTop: 18 }} />
            {edit.status === 'published' ? (
              <Pressable onPress={() => { setEdit(null); navigation.navigate('TabDiscover', { screen: 'EventDetail', params: { id: edit.id } }); }}
                style={styles.secondary} accessibilityRole="button">
                <Text style={styles.secondaryTxt}>Voir la page de l'événement</Text>
              </Pressable>
            ) : null}
            <Danger label="Annuler l'événement" onPress={cancel} />
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

// ── Annonces ────────────────────────────────────────────────────
const EMPTY_NEWS = { title: '', body: '', link_label: '', link_url: '', priority: 10, days: 7, is_active: true };

function News() {
  const [items, setItems] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const load = useCallback(() => adminService.announcements().then(setItems).catch(() => setItems([])), []);
  useEffect(() => { load(); }, [load]);

  const pickVideo = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], videoMaxDuration: VIDEO_MAX_SECONDS, allowsEditing: true, quality: 1 });
    if (res.canceled || !res.assets?.length) return;
    const asset = res.assets[0];
    if (asset.duration && asset.duration / 1000 > VIDEO_MAX_SECONDS + 0.5) {
      showAlert('Vidéo trop longue', `${VIDEO_MAX_SECONDS} secondes au plus.`);
      return;
    }
    setProgress(0);
    try {
      const { publicId } = await uploadVideo(asset, setProgress);
      setEdit((e) => ({ ...e, videoPublicId: publicId, videoName: 'Vidéo prête', video: null }));
    } catch (err) {
      showAlert('Envoi impossible', errMsg(err, err.message || 'Réessayez avec une connexion stable.'));
    } finally { setProgress(null); }
  };

  const save = async () => {
    setBusy(true);
    const body = { title: edit.title, body: edit.body, link_label: edit.link_label, link_url: edit.link_url.trim(),
      priority: edit.priority, is_active: edit.is_active };
    if (edit.days !== undefined) {
      const start = edit.id ? new Date(edit.starts_at) : new Date();
      body.ends_at = edit.days ? new Date(Math.max(start.getTime(), Date.now()) + edit.days * 86400000).toISOString() : null;
    }
    if (edit.videoPublicId) body.video = { public_id: edit.videoPublicId, caption: edit.caption || '' };
    else if (edit.video && edit.caption !== edit.video.caption) body.video = { public_id: edit.video_public_id || '', caption: edit.caption || '' };
    if (edit.removeVideo) body.video = null;
    try {
      if (edit.id) await adminService.updateAnnouncement(edit.id, body);
      else await adminService.createAnnouncement(body);
      setEdit(null);
      load();
    } catch (err) {
      showAlert('Enregistrement impossible', errMsg(err, 'Réessayez.'));
    } finally { setBusy(false); }
  };
  const destroy = () => showAlert("Supprimer l'annonce ?", 'Elle disparaît du fil de tous les utilisateurs.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: async () => {
      try { await adminService.deleteAnnouncement(edit.id); setEdit(null); load(); } catch (err) { showAlert('Suppression impossible', errMsg(err, 'Réessayez.')); }
    } },
  ]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 0 }}>
        <PrimaryButton label="Nouvelle annonce" icon="megaphone-outline" onPress={() => setEdit({ ...EMPTY_NEWS })} />
      </View>
      {items === null ? <ActivityIndicator color={C.green} style={{ marginTop: 30 }} /> : (
        <FlatList
          data={items}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          ListEmptyComponent={<Text style={styles.empty}>Aucune annonce. Elles apparaissent en tête du fil de tous les utilisateurs.</Text>}
          renderItem={({ item: a }) => (
            <Pressable onPress={() => setEdit({ ...a, link_url: a.link_url || '', link_label: a.link_label || '', body: a.body || '',
              caption: a.video?.caption || '', days: undefined })} style={styles.row} accessibilityRole="button"
              accessibilityLabel={`${a.title}, ${a.live ? 'en cours de diffusion' : 'hors diffusion'}`}>
              <Ionicons name={a.video ? 'videocam-outline' : 'megaphone-outline'} size={22} color={C.green} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{a.title}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {`${PRIORITIES.find(([p]) => p === a.priority)?.[1] || ''} · ${a.ends_at ? `jusqu'au ${shortDate(a.ends_at)}` : 'sans fin'}`}
                </Text>
              </View>
              <Text style={[styles.tag, a.live ? styles.tagPaid : styles.tagOff]}>{a.live ? 'En ligne' : 'Hors ligne'}</Text>
            </Pressable>
          )}
        />
      )}

      <Sheet visible={!!edit} title={edit?.id ? "Modifier l'annonce" : 'Nouvelle annonce'} onClose={() => setEdit(null)}>
        {edit ? (
          <>
            <Field label="Titre" value={edit.title} max={90} onChangeText={(v) => setEdit({ ...edit, title: v })} />
            <Field label="Texte" value={edit.body} max={400} multiline onChangeText={(v) => setEdit({ ...edit, body: v })} />
            <Field label="Lien (https://…, facultatif)" value={edit.link_url} onChangeText={(v) => setEdit({ ...edit, link_url: v })}
              autoCapitalize="none" keyboardType="url" />
            {edit.link_url ? <Field label="Texte du bouton" value={edit.link_label} max={30} placeholder="En savoir plus"
              onChangeText={(v) => setEdit({ ...edit, link_label: v })} /> : null}
            <Chips label="Priorité" options={PRIORITIES} value={edit.priority} onChange={(p) => setEdit({ ...edit, priority: p })} />
            <Chips label={edit.id ? `Diffusion${edit.ends_at && edit.days === undefined ? ` (jusqu'au ${shortDate(edit.ends_at)})` : ''}` : 'Diffusion'}
              options={DURATIONS} value={edit.days} onChange={(d) => setEdit({ ...edit, days: d })} />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Diffuser</Text>
              <Switch value={edit.is_active} onValueChange={(v) => setEdit({ ...edit, is_active: v })} trackColor={{ true: C.green }} accessibilityLabel="Diffuser l'annonce" />
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>{`Vidéo (${VIDEO_MAX_SECONDS} s au plus, facultative)`}</Text>
            {edit.video && !edit.removeVideo && !edit.videoPublicId ? <EventVideo video={edit.video} maxWidth={260} maxHeightRatio={0.35} style={{ marginTop: 8 }} /> : null}
            {edit.videoPublicId ? <Text style={styles.meta}>Nouvelle vidéo envoyée : elle est vérifiée à l'enregistrement.</Text> : null}
            {progress !== null ? <Text style={styles.meta}>{`Envoi… ${Math.round(progress * 100)} %`}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
              <Pressable onPress={pickVideo} disabled={progress !== null} style={styles.secondary} accessibilityRole="button">
                <Text style={styles.secondaryTxt}>{edit.video || edit.videoPublicId ? 'Remplacer la vidéo' : 'Ajouter une vidéo'}</Text>
              </Pressable>
              {(edit.video && !edit.removeVideo) || edit.videoPublicId ? (
                <Pressable onPress={() => setEdit({ ...edit, removeVideo: true, videoPublicId: null })} style={styles.secondary} accessibilityRole="button">
                  <Text style={styles.secondaryTxt}>Retirer la vidéo</Text>
                </Pressable>
              ) : null}
            </View>
            {(edit.video && !edit.removeVideo) || edit.videoPublicId ? (
              <Field label="Légende de la vidéo" value={edit.caption || ''} max={220} onChangeText={(v) => setEdit({ ...edit, caption: v })} />
            ) : null}

            <PrimaryButton label={edit.id ? 'Enregistrer' : "Publier l'annonce"} loading={busy} disabled={!edit.title.trim() || progress !== null}
              onPress={save} style={{ marginTop: 18 }} />
            {edit.id ? <Danger label="Supprimer l'annonce" onPress={destroy} /> : null}
          </>
        ) : null}
      </Sheet>
    </View>
  );
}

export default function AdminScreen({ navigation }) {
  const [tab, setTab] = useState('overview');
  const { user: me } = useAuth();

  if (!me?.is_staff) {
    return (
      <SafeAreaView style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Ionicons name="lock-closed-outline" size={40} color={C.textMut} />
        <Text style={[styles.empty, { marginTop: 12 }]}>Cet espace est réservé à l'équipe Easevent.</Text>
        <PrimaryButton label="Retour" onPress={() => navigation.goBack()} style={{ marginTop: 16, alignSelf: 'stretch' }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <BackButton variant="square" onPress={() => navigation.goBack()} />
        <Text style={styles.title} accessibilityRole="header">Administration</Text>
        <View style={{ width: 44 }} />
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {TABS.map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabOn]}
            accessibilityRole="tab" accessibilityState={{ selected: tab === id }} aria-selected={tab === id}>
            <Text style={[styles.tabTxt, tab === id && styles.tabTxtOn]} numberOfLines={1}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        {tab === 'overview' ? <Overview /> : null}
        {tab === 'users' ? <Users me={me} /> : null}
        {tab === 'events' ? <Events navigation={navigation} /> : null}
        {tab === 'news' ? <News /> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  title: { flex: 1, fontSize: 20, fontWeight: '900', color: C.text, textAlign: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, backgroundColor: C.white, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabOn: { backgroundColor: C.green },
  tabTxt: { fontSize: 13, fontWeight: '700', color: C.textSub },
  tabTxtOn: { color: C.white },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 16 },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: C.white, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.border, gap: 2 },
  statN: { fontSize: 30, fontWeight: '900', color: C.text, marginTop: 6 },
  statLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  statSub: { fontSize: 12, color: C.textSub, marginTop: 2 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, minHeight: TOUCH },
  searchInput: { flex: 1, fontSize: 15, color: C.text, paddingVertical: 10 },
  addBtn: { width: TOUCH, height: TOUCH, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 13, color: C.textSub, marginBottom: 4 },
  empty: { fontSize: 14, color: C.textSub, textAlign: 'center', marginTop: 30, lineHeight: 20, paddingHorizontal: 20 },
  error: { color: C.errorText, textAlign: 'center', marginTop: 16, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.white, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: C.border, minHeight: 64 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontWeight: '800', color: C.green },
  rowTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  rowSub: { fontSize: 13, color: C.textSub, marginTop: 2 },
  tag: { fontSize: 11, fontWeight: '800', color: C.textSub, backgroundColor: C.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden' },
  tagPaid: { color: C.green, backgroundColor: C.greenLight },
  tagOff: { color: C.errorText, backgroundColor: C.errorBg },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30, maxHeight: '92%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 4 },
  meta: { fontSize: 13, color: C.textSub, lineHeight: 19, marginTop: 4 },
  label: { fontSize: 13, fontWeight: '700', color: C.textSub, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 15, color: C.text, backgroundColor: C.inputBg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: 999, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  chipOn: { borderColor: C.green, backgroundColor: C.greenLight },
  chipTxt: { fontSize: 14, fontWeight: '600', color: C.text },
  chipTxtOn: { color: C.green, fontWeight: '800' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, minHeight: TOUCH },
  switchLabel: { fontSize: 15, fontWeight: '600', color: C.text },
  secondary: { alignSelf: 'flex-start', minHeight: TOUCH, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, borderColor: C.green, marginTop: 12 },
  secondaryTxt: { color: C.green, fontWeight: '700', fontSize: 14 },
  danger: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: TOUCH, marginTop: 16 },
  dangerTxt: { color: C.errorText, fontWeight: '700', fontSize: 15 },
});
