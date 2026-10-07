/**
 * ScanTicketsScreen.js — Easevent · contrôle des tickets à l'entrée
 * ════════════════════════════════════════════════════════════════
 * L'organisateur vise le QR code du participant : vert (bienvenue),
 * orange (déjà entré), rouge (ticket invalide / autre événement / non
 * payé). Vibration différente selon le résultat. Saisie du numéro
 * (EV-XXXXXXXX) si l'écran du participant est illisible.
 * Le serveur garantit qu'un ticket n'entre qu'une seule fois.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
// Caméra : seulement dans l'application mobile (sur le web, saisie du numéro)
const Camera = Platform.OS !== 'web' ? require('expo-camera') : null;
const CameraView = Camera?.CameraView;
const useCameraPermissions = Camera?.useCameraPermissions || (() => [null, async () => null]);
import * as Haptics from 'expo-haptics';
import { useIsFocused } from '@react-navigation/native';

import { C, TOUCH } from '../constants/theme';
import { BackButton, PrimaryButton } from '../components/ui/Buttons';
import { apiClient } from '../services/apiClient';
import { apiErrorMessage } from '../services/authService';

const RESULT = {
  ok:          { color: C.green,   bg: C.greenLight, icon: 'checkmark-circle', title: 'Bienvenue !' },
  already:     { color: '#B45309', bg: '#FFFBEB',    icon: 'alert-circle',     title: 'Déjà entré' },
  invalid:     { color: C.error,   bg: C.errorBg,    icon: 'close-circle',     title: 'Code invalide' },
  wrong_event: { color: C.error,   bg: C.errorBg,    icon: 'close-circle',     title: 'Autre événement' },
  not_valid:   { color: C.error,   bg: C.errorBg,    icon: 'close-circle',     title: 'Non valable' },
};
const SAME_CODE_PAUSE = 3000;

const hhmm = (iso) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

export default function ScanTicketsScreen({ navigation, route }) {
  const event = route?.params?.event || {};
  const url = `/api/events/${event.id}/check-in/`;
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [counts, setCounts] = useState(null);
  const [recent, setRecent] = useState([]);
  const [result, setResult] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const last = useRef({ code: '', at: 0 });
  const working = useRef(false);

  const load = useCallback(async () => {
    try {
      const { data } = await apiClient.get(url);
      setCounts(data.counts);
      setRecent(data.recent);
    } catch (err) {
      setError(apiErrorMessage(err, 'Impossible de charger les entrées.'));
    }
  }, [url]);

  useEffect(() => { load(); }, [load]);

  const check = async (raw, fromCamera = false) => {
    const value = String(raw || '').trim();
    if (!value || working.current) return;
    const now = Date.now();
    // Même QR resté devant la caméra : ignoré quelques secondes (la saisie manuelle, elle, est toujours vérifiée)
    if (fromCamera && value === last.current.code && now - last.current.at < SAME_CODE_PAUSE) return;
    last.current = { code: value, at: now };
    working.current = true;
    setBusy(true);
    setError('');
    try {
      const { data } = await apiClient.post(url, { code: value });
      setResult(data);
      setCounts(data.counts);
      if (data.result === 'ok') {
        setRecent((r) => [data.participant, ...r].slice(0, 20));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (data.result === 'already') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      setCode('');
    } catch (err) {
      setError(apiErrorMessage(err, 'Vérification impossible. Vérifiez la connexion.'));
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  const r = result ? RESULT[result.result] || RESULT.invalid : null;
  const cameraReady = Platform.OS !== 'web' && permission?.granted;

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <BackButton variant="square" onPress={() => navigation.goBack()} />
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.headerTitle} accessibilityRole="header">Contrôle des entrées</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{event.title}</Text>
          </View>
          <View style={styles.counter} accessibilityLabel={counts ? `${counts.checked_in} entrées sur ${counts.total} attendues` : 'Chargement'}>
            <Text style={styles.counterTxt}>{counts ? `${counts.checked_in}/${counts.total}` : '…'}</Text>
          </View>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.cameraBox}>
              {cameraReady && focused ? (
                <CameraView style={StyleSheet.absoluteFill} facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={busy ? undefined : ({ data }) => check(data, true)} />
              ) : (
                <View style={styles.cameraOff}>
                  <Ionicons name="qr-code-outline" size={46} color={C.green} />
                  {Platform.OS === 'web' ? (
                    <Text style={styles.cameraTxt}>Le scanner fonctionne dans l'application mobile. Ici, saisissez le numéro inscrit sous le QR code.</Text>
                  ) : permission && !permission.granted && !permission.canAskAgain ? (
                    <Text style={styles.cameraTxt}>Autorisez l'appareil photo pour Easevent dans les réglages du téléphone.</Text>
                  ) : (
                    <>
                      <Text style={styles.cameraTxt}>L'appareil photo sert à lire les QR codes des invitations et billets.</Text>
                      <PrimaryButton label="Activer l'appareil photo" icon="camera-outline" onPress={requestPermission} />
                    </>
                  )}
                </View>
              )}
              {cameraReady && <View pointerEvents="none" style={styles.frame} />}
            </View>

            {r ? (
              <View style={[styles.result, { backgroundColor: r.bg, borderColor: r.color }]} accessibilityLiveRegion="assertive" accessibilityRole="alert">
                <Ionicons name={r.icon} size={40} color={r.color} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultTitle, { color: r.color }]}>{r.title}</Text>
                  {result.participant ? <Text style={styles.resultName}>{result.participant.name}</Text> : null}
                  <Text style={styles.resultTxt}>
                    {result.participant?.number ? `${result.participant.number} · ` : ''}{result.detail}
                    {result.result === 'already' && result.participant?.checked_in_at ? ` (à ${hhmm(result.participant.checked_in_at)})` : ''}
                  </Text>
                  {result.participant?.dress_code && result.result === 'ok' ? <Text style={styles.resultTxt}>Dress code : {result.participant.dress_code}</Text> : null}
                </View>
              </View>
            ) : null}
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

            <Text style={styles.label} nativeID="manualLabel">Saisir le numéro (sous le QR code)</Text>
            <View style={styles.manual}>
              <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="EV-XXXXXXXX"
                placeholderTextColor={C.textFaint} autoCapitalize="characters" autoCorrect={false}
                accessibilityLabel="Numéro de l'invitation ou du billet" onSubmitEditing={() => check(code)} returnKeyType="done" />
              <Pressable onPress={() => check(code)} disabled={!code.trim() || busy} style={[styles.checkBtn, (!code.trim() || busy) && { opacity: 0.5 }]}
                accessibilityRole="button" accessibilityLabel="Vérifier le code">
                <Ionicons name="checkmark" size={22} color={C.white} />
              </Pressable>
            </View>

            {recent.length ? (
              <View style={styles.recent}>
                <Text style={styles.label}>Dernières entrées</Text>
                {recent.map((p, i) => (
                  <View key={`${p.number}-${i}`} style={styles.recentRow}>
                    <Ionicons name="checkmark-circle" size={18} color={C.green} />
                    <Text style={styles.recentName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.recentTime}>{p.checked_in_at ? hhmm(p.checked_in_at) : ''}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  headerSub: { fontSize: 12, color: C.textMut },
  counter: { minWidth: 56, height: 36, borderRadius: 12, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  counterTxt: { fontSize: 14, fontWeight: '900', color: C.greenDark },
  scroll: { padding: 16, gap: 14, paddingBottom: 40, width: '100%', maxWidth: 560, alignSelf: 'center' },
  cameraBox: { height: 320, borderRadius: 22, overflow: 'hidden', backgroundColor: '#0F2219' },
  cameraOff: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 22 },
  cameraTxt: { fontSize: 14, color: C.textSub, textAlign: 'center', lineHeight: 20 },
  frame: { position: 'absolute', top: 50, left: '50%', marginLeft: -110, width: 220, height: 220, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  result: { flexDirection: 'row', gap: 14, alignItems: 'center', borderRadius: 18, borderWidth: 2, padding: 16 },
  resultTitle: { fontSize: 20, fontWeight: '900' },
  resultName: { fontSize: 17, fontWeight: '800', color: C.text, marginTop: 2 },
  resultTxt: { fontSize: 13, color: C.textSub, marginTop: 2 },
  error: { fontSize: 14, color: C.errorText },
  label: { fontSize: 12, fontWeight: '800', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
  manual: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white, paddingHorizontal: 14, fontSize: 17, fontWeight: '700', color: C.text, letterSpacing: 1 },
  checkBtn: { width: 52, height: 52, borderRadius: 14, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  recent: { backgroundColor: C.white, borderRadius: 16, padding: 14, gap: 4, borderWidth: 1, borderColor: C.border },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TOUCH - 8 },
  recentName: { flex: 1, fontSize: 15, color: C.text, fontWeight: '600' },
  recentTime: { fontSize: 13, color: C.textMut },
});
