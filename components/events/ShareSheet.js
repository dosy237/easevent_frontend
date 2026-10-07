/**
 * components/events/ShareSheet.js — partager un événement public
 * ════════════════════════════════════════════════════════════════
 * 1. Copier le lien : collé dans WhatsApp, Facebook, un SMS…, il affiche un
 *    aperçu (photo, titre, date) grâce à la page /e/<id>/ du serveur.
 * 2. Partager via… : la feuille de partage du téléphone.
 * 3. Envoyer à des amis Easevent : la carte de l'événement arrive aussitôt
 *    dans leur messagerie (conversation directe).
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { C } from '../../constants/theme';
import eventService from '../../services/eventService';
import friendService from '../../services/friendService';
import { PrimaryButton } from '../ui/Buttons';

export default function ShareSheet({ event, visible, onClose, isAuthenticated, onAddFriends, onSent }) {
  const [friends, setFriends] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const url = event?.share_url;

  useEffect(() => {
    if (!visible) return;
    setPicked(new Set()); setQuery(''); setMessage(''); setNotice('');
    if (isAuthenticated) friendService.list().then((d) => setFriends(d.friends || [])).catch(() => setFriends([]));
  }, [visible, isAuthenticated]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (friends || []).filter((f) => !q || `${f.user.first_name} ${f.user.last_name}`.toLowerCase().includes(q));
  }, [friends, query]);

  const flash = (text) => { setNotice(text); setTimeout(() => setNotice(''), 2500); };
  const copy = async () => {
    if (!url) return;
    await Clipboard.setStringAsync(url).catch(() => {});
    flash('Lien copié : collez-le où vous voulez, l’aperçu s’affiche.');
  };
  const shareVia = async () => {
    if (!url) return;
    const text = `${event.title} — ${url}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) { await copy(); return; }
      await Share.share(Platform.OS === 'ios' ? { message: event.title, url } : { message: text, title: event.title });
    } catch {
      await copy();
    }
  };
  const toggle = (id) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else if (next.size < 20) next.add(id);
    return next;
  });
  const send = async () => {
    if (!picked.size || busy) return;
    setBusy(true);
    try {
      const res = await eventService.share(event.id, [...picked], message.trim());
      onSent?.(res);
      onClose();
    } catch (err) {
      flash(err.response?.data?.detail || 'Envoi impossible. Réessayez.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Fermer le partage" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.sheetWrap} pointerEvents="box-none">
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>{`Partager « ${event?.title || ''} »`}</Text>

          <View style={styles.actions}>
            <Pressable onPress={copy} style={styles.action} accessibilityRole="button" accessibilityLabel="Copier le lien">
              <View style={styles.actionIcon}><Ionicons name="link-outline" size={22} color={C.green} /></View>
              <Text style={styles.actionTxt}>Copier le lien</Text>
            </Pressable>
            <Pressable onPress={shareVia} style={styles.action} accessibilityRole="button" accessibilityLabel="Partager via une autre application">
              <View style={styles.actionIcon}><Ionicons name="share-social-outline" size={22} color={C.green} /></View>
              <Text style={styles.actionTxt}>Partager via…</Text>
            </Pressable>
          </View>
          {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}

          {isAuthenticated ? (
            <>
              <Text style={styles.section}>Envoyer à des amis Easevent</Text>
              {friends === null ? <ActivityIndicator color={C.green} style={{ marginVertical: 20 }} /> : friends.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTxt}>Ajoutez des amis pour leur envoyer vos événements en un geste.</Text>
                  {onAddFriends ? <Pressable onPress={() => { onClose(); onAddFriends(); }} accessibilityRole="button" style={styles.link}>
                    <Text style={styles.linkTxt}>Trouver des amis</Text></Pressable> : null}
                </View>
              ) : (
                <>
                  {friends.length > 6 ? (
                    <TextInput value={query} onChangeText={setQuery} placeholder="Rechercher un ami" style={styles.input}
                      accessibilityLabel="Rechercher un ami" placeholderTextColor={C.textMut} />
                  ) : null}
                  <FlatList
                    data={shown}
                    keyExtractor={(f) => f.user.id}
                    style={{ maxHeight: 240 }}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => {
                      const on = picked.has(item.user.id);
                      return (
                        <Pressable onPress={() => toggle(item.user.id)} style={styles.friend} accessibilityRole="checkbox"
                          accessibilityState={{ checked: on }} aria-checked={on} accessibilityLabel={item.user.name}>
                          <View style={styles.avatar}><Text style={styles.avatarTxt}>{item.user.initials}</Text></View>
                          <Text style={styles.friendName} numberOfLines={1}>{item.user.name}</Text>
                          <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? C.green : C.textMut} />
                        </Pressable>
                      );
                    }}
                  />
                  {picked.size ? (
                    <TextInput value={message} onChangeText={setMessage} placeholder="Un mot avec le partage (facultatif)"
                      style={styles.input} maxLength={500} accessibilityLabel="Message accompagnant le partage" placeholderTextColor={C.textMut} />
                  ) : null}
                  <PrimaryButton label={picked.size ? `Envoyer à ${picked.size} ami${picked.size > 1 ? 's' : ''}` : 'Choisissez des amis'}
                    disabled={!picked.size} loading={busy} onPress={send} style={{ marginTop: 10 }} />
                </>
              )}
            </>
          ) : (
            <Text style={styles.hint}>Connectez-vous pour envoyer l’événement à vos amis Easevent.</Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 34, maxHeight: '88%', width: '100%', maxWidth: 560, alignSelf: 'center' },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  action: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, borderRadius: 16, backgroundColor: C.bg },
  actionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  actionTxt: { fontSize: 14, fontWeight: '700', color: C.text },
  notice: { marginTop: 10, fontSize: 13, color: C.green, fontWeight: '600', textAlign: 'center' },
  section: { marginTop: 20, marginBottom: 8, fontSize: 15, fontWeight: '800', color: C.text },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontWeight: '800', color: C.green },
  friendName: { flex: 1, fontSize: 15, fontWeight: '600', color: C.text },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, fontSize: 15, color: C.text, marginVertical: 8 },
  empty: { paddingVertical: 12 },
  emptyTxt: { fontSize: 14, color: C.textSub, lineHeight: 20 },
  link: { paddingVertical: 10 },
  linkTxt: { color: C.green, fontWeight: '700', fontSize: 15 },
  hint: { marginTop: 18, fontSize: 14, color: C.textSub, lineHeight: 20 },
});
