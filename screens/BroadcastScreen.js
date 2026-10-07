/**
 * screens/BroadcastScreen.js — message à tous les invités
 * ════════════════════════════════════════════════════════════════
 * Le message arrive dans la conversation de chaque invité qui a un compte,
 * avec une notification. Les messages déjà envoyés sont listés dessous.
 * params : { event }
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { BackButton, PrimaryButton } from '../components/ui/Buttons';
import { C } from '../constants/theme';
import teamService from '../services/teamService';
import { apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';
import { formatDateRelative } from '../utils/format';

const MAX = 1000;

export default function BroadcastScreen({ route, navigation }) {
  const event = route?.params?.event || {};
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try { setInfo(await teamService.broadcastInfo(event.id)); setError(''); }
    catch (err) { setError(apiErrorMessage(err, 'Impossible de charger vos invités.')); }
  }, [event.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const send = () => {
    const n = info?.recipients || 0;
    showAlert('Envoyer à tous les invités ?', `${n} invité${n > 1 ? 's' : ''} recevr${n > 1 ? 'ont' : 'a'} ce message dans sa messagerie.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Envoyer', onPress: async () => {
        setSending(true);
        try {
          const r = await teamService.broadcast(event.id, message.trim());
          setMessage('');
          showAlert('Message envoyé', r.detail);
          load();
        } catch (err) { showAlert('Envoi impossible', apiErrorMessage(err)); }
        finally { setSending(false); }
      } },
    ]);
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} accessibilityRole="header">Message à tous les invités</Text>
          <Text style={s.sub} numberOfLines={1}>{event.title}</Text>
        </View>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
          {error ? <Text style={s.error}>{error}</Text> : null}
          {!info && !error ? <ActivityIndicator color={C.green} style={{ marginTop: 40 }} /> : null}
          {info ? (
            <>
              <Text style={s.hint}>
                {info.recipients
                  ? `${info.recipients} invité${info.recipients > 1 ? 's' : ''} le recevr${info.recipients > 1 ? 'ont' : 'a'} dans sa messagerie, avec une notification.`
                  : "Aucun invité n'a encore de compte pour recevoir un message."}
                {info.without_account ? ` ${info.without_account} invité${info.without_account > 1 ? 's' : ''} sans compte ne le recevr${info.without_account > 1 ? 'ont' : 'a'} pas.` : ''}
              </Text>
              <TextInput style={s.input} value={message} onChangeText={setMessage} multiline maxLength={MAX}
                placeholder="Ex. : Rendez-vous à 15 h, entrée côté jardin. Pensez à votre invitation !"
                placeholderTextColor={C.textMut} accessibilityLabel="Votre message" />
              <Text style={s.count}>{message.length} / {MAX}</Text>
              <PrimaryButton label="Envoyer à tous" icon="megaphone-outline" onPress={send} loading={sending}
                disabled={!message.trim() || !info.recipients} />

              {info.history.length ? (
                <>
                  <Text style={s.section}>Déjà envoyés</Text>
                  {info.history.map((b) => (
                    <View key={b.id} style={s.card}>
                      <Text style={s.body}>{b.body}</Text>
                      <Text style={s.meta}>
                        {formatDateRelative(b.created_at)} · {b.recipients} invité{b.recipients > 1 ? 's' : ''}{b.sent_by ? ` · ${b.sent_by}` : ''}
                      </Text>
                    </View>
                  ))}
                </>
              ) : null}
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
  title: { fontSize: 17, fontWeight: '800', color: C.text },
  sub: { fontSize: 12, color: C.textMut },
  pad: { padding: 16, paddingBottom: 40 },
  error: { color: C.errorText, marginBottom: 12 },
  hint: { fontSize: 13, color: C.textSub, lineHeight: 19, marginBottom: 12 },
  input: { minHeight: 130, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 12, backgroundColor: C.white, color: C.text, textAlignVertical: 'top', fontSize: 15 },
  count: { alignSelf: 'flex-end', fontSize: 11, color: C.textMut, marginVertical: 6 },
  section: { fontSize: 12, fontWeight: '800', color: C.textMut, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 24, marginBottom: 8 },
  card: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 10 },
  body: { fontSize: 14, color: C.text, lineHeight: 20 },
  meta: { fontSize: 11, color: C.textMut, marginTop: 6 },
});
