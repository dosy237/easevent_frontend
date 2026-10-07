/**
 * screens/MemoriesScreen.js — espace souvenirs d'un événement
 * ════════════════════════════════════════════════════════════════
 * Photos : ajoutées par les organisateurs et les photographes (à partir du
 * début de l'événement), visibles par tous les invités.
 * Commentaires : ouverts à la fin de l'événement (public : tout le monde ;
 * privé : les invités).
 * params : { event, tab? : 'photos' | 'comments' }
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput,
  useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';

import { BackButton, PrimaryButton } from '../components/ui/Buttons';
import ImageViewer from '../components/ui/ImageViewer';
import { C, TOUCH } from '../constants/theme';
import teamService from '../services/teamService';
import { apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';
import { formatDateRelative } from '../utils/format';

export default function MemoriesScreen({ route, navigation }) {
  const event = route?.params?.event || {};
  const [tab, setTab] = useState(route?.params?.tab || 'photos');
  const [photos, setPhotos] = useState(null);
  const [comments, setComments] = useState(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(0);
  const [viewer, setViewer] = useState(null);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const { width } = useWindowDimensions();
  const size = Math.floor((Math.min(width, 640) - 32 - 12) / 3);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([teamService.memories(event.id), teamService.comments(event.id)]);
      setPhotos(p); setComments(c); setError('');
    } catch (err) {
      setError(apiErrorMessage(err, "L'espace souvenirs n'est pas accessible."));
    }
  }, [event.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addPhotos = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Accès aux photos', 'Autorisez Easevent à accéder à vos photos pour les ajouter aux souvenirs.');
        return;
      }
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: true, selectionLimit: 20 });
    if (res.canceled || !res.assets?.length) return;
    let failed = 0;
    setUploading(res.assets.length);
    for (const asset of res.assets) {
      try {
        const saved = await teamService.addPhoto(event.id, asset);
        setPhotos((p) => ({ ...p, photos: [saved, ...(p?.photos || [])] }));
      } catch (err) {
        failed += 1;
        if (failed === 1) showAlert('Photo non ajoutée', apiErrorMessage(err));
      }
      setUploading((n) => n - 1);
    }
    setUploading(0);
  };

  const removePhoto = (p) => showAlert('Supprimer cette photo ?', 'Elle disparaîtra pour tous les invités.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: async () => {
      try {
        await teamService.deletePhoto(event.id, p.id);
        setPhotos((prev) => ({ ...prev, photos: prev.photos.filter((x) => x.id !== p.id) }));
      } catch (err) { showAlert('Suppression impossible', apiErrorMessage(err)); }
    } },
  ]);

  const send = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const c = await teamService.addComment(event.id, body.trim());
      setComments((prev) => ({ ...prev, count: (prev?.count || 0) + 1, comments: [c, ...(prev?.comments || [])] }));
      setBody('');
    } catch (err) { showAlert('Commentaire non envoyé', apiErrorMessage(err)); }
    finally { setSending(false); }
  };

  const removeComment = (c) => showAlert('Supprimer ce commentaire ?', '', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Supprimer', style: 'destructive', onPress: async () => {
      try {
        await teamService.deleteComment(event.id, c.id);
        setComments((prev) => ({ ...prev, count: prev.count - 1, comments: prev.comments.filter((x) => x.id !== c.id) }));
      } catch (err) { showAlert('Suppression impossible', apiErrorMessage(err)); }
    } },
  ]);

  const list = photos?.photos || [];
  const canAdd = !!photos?.can_add;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} accessibilityRole="header">Souvenirs</Text>
          <Text style={s.sub} numberOfLines={1}>{event.title}</Text>
        </View>
      </View>
      <View style={s.tabs} accessibilityRole="tablist">
        {[['photos', `Photos${photos ? ` (${list.length})` : ''}`], ['comments', `Commentaires${comments ? ` (${comments.count})` : ''}`]].map(([id, label]) => (
          <Pressable key={id} style={[s.tab, tab === id && s.tabOn]} onPress={() => setTab(id)}
            accessibilityRole="tab" accessibilityState={{ selected: tab === id }} aria-selected={tab === id}>
            <Text style={[s.tabTxt, tab === id && s.tabTxtOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
          {error ? <Text style={s.error}>{error}</Text> : null}
          {!photos && !error ? <ActivityIndicator color={C.green} style={{ marginTop: 40 }} /> : null}

          {photos && tab === 'photos' ? (
            <>
              {canAdd ? (
                <PrimaryButton label={uploading ? `Envoi… (${uploading} restante${uploading > 1 ? 's' : ''})` : 'Ajouter des photos'}
                  icon="images-outline" onPress={addPhotos} loading={uploading > 0} style={{ marginBottom: 14 }} />
              ) : null}
              {photos.role === 'photographer' ? (
                <Text style={s.hint}>Vous êtes photographe de cet événement : vos photos sont visibles par tous les invités.</Text>
              ) : null}
              {photos.phase === 'upcoming' && (photos.role || !list.length) ? (
                <Text style={s.hint}>Les photos souvenirs s'ajoutent à partir du début de l'événement.</Text>
              ) : null}
              {!list.length && photos.phase !== 'upcoming' ? (
                <View style={s.empty}>
                  <Ionicons name="images-outline" size={36} color={C.textMut} />
                  <Text style={s.emptyTxt}>{canAdd ? 'Ajoutez les premières photos de l’événement.' : 'Les organisateurs n’ont pas encore ajouté de photos.'}</Text>
                </View>
              ) : null}
              <View style={s.grid}>
                {list.map((p) => (
                  <Pressable key={p.id} onPress={() => setViewer(p.url)} onLongPress={p.can_delete ? () => removePhoto(p) : undefined}
                    accessibilityRole="imagebutton" accessibilityLabel={p.caption || `Photo de ${p.uploader?.name || 'l’équipe'}`}
                    accessibilityHint={p.can_delete ? 'Appui long pour supprimer' : undefined}>
                    <Image source={{ uri: p.url }} style={{ width: size, height: size, borderRadius: 10, backgroundColor: C.skeleton }} />
                    {p.can_delete ? (
                      <Pressable style={s.del} onPress={() => removePhoto(p)} accessibilityRole="button" accessibilityLabel="Supprimer la photo" hitSlop={6}>
                        <Ionicons name="trash-outline" size={14} color="#FFF" />
                      </Pressable>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {comments && tab === 'comments' ? (
            <>
              {comments.open ? (
                <View style={s.composer}>
                  <TextInput style={s.input} value={body} onChangeText={setBody} placeholder="Un mot sur l'événement…"
                    placeholderTextColor={C.textMut} multiline maxLength={1000} accessibilityLabel="Votre commentaire" />
                  <Pressable style={[s.send, (!body.trim() || sending) && { opacity: 0.5 }]} onPress={send} disabled={!body.trim() || sending}
                    accessibilityRole="button" accessibilityLabel="Publier le commentaire">
                    {sending ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="send" size={18} color="#FFF" />}
                  </Pressable>
                </View>
              ) : (
                <Text style={s.hint}>Les commentaires s'ouvrent à la fin de l'événement.</Text>
              )}
              {!comments.comments.length && comments.open ? (
                <View style={s.empty}>
                  <Ionicons name="chatbubbles-outline" size={36} color={C.textMut} />
                  <Text style={s.emptyTxt}>Soyez le premier à laisser un mot.</Text>
                </View>
              ) : null}
              {comments.comments.map((c) => (
                <View key={c.id} style={s.comment}>
                  <View style={s.avatar}><Text style={s.avatarTxt}>{c.author.initials}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.author}>{c.author.name}{c.is_team ? <Text style={s.team}>  · Organisateur</Text> : null}</Text>
                    <Text style={s.body}>{c.body}</Text>
                    <Text style={s.when}>{formatDateRelative(c.created_at)}</Text>
                  </View>
                  {c.can_delete ? (
                    <Pressable style={s.iconBtn} onPress={() => removeComment(c)} accessibilityRole="button" accessibilityLabel="Supprimer le commentaire">
                      <Ionicons name="trash-outline" size={16} color={C.textMut} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <ImageViewer uri={viewer} onClose={() => setViewer(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  sub: { fontSize: 12, color: C.textMut },
  tabs: { flexDirection: 'row', backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, minHeight: TOUCH, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: C.green },
  tabTxt: { fontSize: 13, fontWeight: '600', color: C.textMut },
  tabTxtOn: { color: C.green, fontWeight: '800' },
  pad: { padding: 16, paddingBottom: 40 },
  error: { color: C.errorText, marginBottom: 12 },
  hint: { fontSize: 13, color: C.textSub, lineHeight: 19, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  del: { position: 'absolute', top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTxt: { fontSize: 14, color: C.textSub, textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 16 },
  input: { flex: 1, minHeight: TOUCH, maxHeight: 140, borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.white, color: C.text },
  send: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  comment: { flexDirection: 'row', gap: 10, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontWeight: '800', color: C.green, fontSize: 13 },
  author: { fontSize: 13, fontWeight: '800', color: C.text },
  team: { fontSize: 12, fontWeight: '700', color: C.orange },
  body: { fontSize: 14, color: C.text, lineHeight: 20, marginTop: 2 },
  when: { fontSize: 11, color: C.textMut, marginTop: 4 },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
