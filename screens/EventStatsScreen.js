/**
 * screens/EventStatsScreen.js — statistiques d'un événement
 * ════════════════════════════════════════════════════════════════
 * Vues, « J'aime », invités, réponses, entrées scannées, commentaires, photos.
 * Une fois l'événement commencé : l'organisateur indique combien de personnes
 * étaient réellement présentes (modifiable).
 * params : { event }
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import { BackButton, PrimaryButton } from '../components/ui/Buttons';
import { C, TOUCH } from '../constants/theme';
import teamService from '../services/teamService';
import { apiErrorMessage } from '../services/authService';
import { showAlert } from '../utils/dialog';

const PHASE = { upcoming: 'À venir', live: 'En cours', past: 'Terminé' };

const Tile = ({ icon, value, label, color = C.green }) => (
  <View style={s.tile} accessible accessibilityLabel={`${label} : ${value}`}>
    <View style={[s.tileIcon, { backgroundColor: color + '18' }]}><Ionicons name={icon} size={18} color={color} /></View>
    <Text style={s.tileValue}>{value}</Text>
    <Text style={s.tileLabel}>{label}</Text>
  </View>
);

export default function EventStatsScreen({ route, navigation }) {
  const event = route?.params?.event || {};
  const [st, setSt] = useState(null);
  const [error, setError] = useState('');
  const [count, setCount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await teamService.stats(event.id);
      setSt(d); setError('');
      setCount(d.attendance != null ? String(d.attendance) : '');
    } catch (err) { setError(apiErrorMessage(err, 'Statistiques indisponibles.')); }
  }, [event.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    try {
      const d = await teamService.attendance(event.id, count);
      setSt((prev) => ({ ...prev, ...d }));
      showAlert('Présence enregistrée', d.attendance != null
        ? `${d.attendance} personne${d.attendance > 1 ? 's' : ''} présente${d.attendance > 1 ? 's' : ''}.`
        : 'La présence réelle a été effacée.');
    } catch (err) { showAlert('Enregistrement impossible', apiErrorMessage(err)); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} accessibilityRole="header">Statistiques</Text>
          <Text style={s.sub} numberOfLines={1}>{event.title}</Text>
        </View>
        {st ? <View style={s.phase}><Text style={s.phaseTxt}>{PHASE[st.phase]}</Text></View> : null}
      </View>
      <ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
        {error ? <Text style={s.error}>{error}</Text> : null}
        {!st && !error ? <ActivityIndicator color={C.green} style={{ marginTop: 40 }} /> : null}
        {st ? (
          <>
            <Text style={s.section}>Audience</Text>
            <View style={s.grid}>
              <Tile icon="eye-outline" value={st.views} label="Vues" color={C.blue} />
              <Tile icon="heart-outline" value={st.likes} label="J'aime" color={C.orange} />
              <Tile icon="chatbubbles-outline" value={st.comments} label="Commentaires" />
              <Tile icon="images-outline" value={st.photos} label="Photos" color={C.blue} />
            </View>

            <Text style={s.section}>Invités</Text>
            <View style={s.grid}>
              <Tile icon="mail-outline" value={st.invited} label="Invités" />
              <Tile icon="checkmark-circle-outline" value={st.accepted} label="Ont accepté" />
              <Tile icon="time-outline" value={st.pending} label="Sans réponse" color={C.orange} />
              <Tile icon="close-circle-outline" value={st.declined} label="Déclinés" color={C.error} />
            </View>

            <Text style={s.section}>Le jour J</Text>
            <View style={s.grid}>
              <Tile icon="ticket-outline" value={st.participants} label="Attendus" />
              <Tile icon="qr-code-outline" value={st.checked_in} label="Entrées scannées" color={C.blue} />
              <Tile icon="people-outline" value={st.attendance ?? '—'} label="Présents" color={C.orange} />
              <Tile icon="trending-up-outline" value={st.attendance_rate != null ? `${st.attendance_rate} %` : '—'} label="Taux de présence" />
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Personnes réellement présentes</Text>
              {st.phase === 'upcoming' ? (
                <Text style={s.hint}>Vous pourrez l'indiquer une fois l'événement commencé.</Text>
              ) : (
                <>
                  <Text style={s.hint}>
                    Comptez tout le monde, même ceux qui n'ont pas été scannés à l'entrée
                    ({st.checked_in} entrée{st.checked_in > 1 ? 's' : ''} scannée{st.checked_in > 1 ? 's' : ''}).
                  </Text>
                  <View style={s.row}>
                    <Pressable style={s.step} onPress={() => setCount(String(Math.max(0, (Number(count) || 0) - 1)))}
                      accessibilityRole="button" accessibilityLabel="Une personne de moins">
                      <Ionicons name="remove" size={20} color={C.green} />
                    </Pressable>
                    <TextInput style={s.input} value={count} onChangeText={(v) => setCount(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad" placeholder="0" placeholderTextColor={C.textMut}
                      accessibilityLabel="Nombre de personnes présentes" />
                    <Pressable style={s.step} onPress={() => setCount(String((Number(count) || 0) + 1))}
                      accessibilityRole="button" accessibilityLabel="Une personne de plus">
                      <Ionicons name="add" size={20} color={C.green} />
                    </Pressable>
                  </View>
                  <PrimaryButton label="Enregistrer" onPress={save} loading={saving} />
                </>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  sub: { fontSize: 12, color: C.textMut },
  phase: { backgroundColor: C.greenLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  phaseTxt: { fontSize: 12, fontWeight: '800', color: C.green },
  pad: { padding: 16, paddingBottom: 40 },
  error: { color: C.errorText, marginBottom: 12 },
  section: { fontSize: 12, fontWeight: '800', color: C.textMut, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, gap: 4 },
  tileIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tileValue: { fontSize: 22, fontWeight: '900', color: C.text },
  tileLabel: { fontSize: 12, color: C.textSub },
  card: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 6 },
  hint: { fontSize: 13, color: C.textSub, lineHeight: 19, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  step: { width: TOUCH, height: TOUCH, borderRadius: 12, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, width: 0, minHeight: TOUCH, borderWidth: 1, borderColor: C.border, borderRadius: 12, textAlign: 'center', fontSize: 20, fontWeight: '800', color: C.text, backgroundColor: C.inputBg },
});
