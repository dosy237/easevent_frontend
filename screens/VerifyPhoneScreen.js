/**
 * VerifyPhoneScreen.js — Easevent (numéro de téléphone du compte)
 * ════════════════════════════════════════════════════════════════
 * 1. Numéro (avec indicatif) → code à 6 chiffres envoyé par SMS.
 * 2. Code → numéro vérifié : les invitations reçues par SMS sur ce
 *    numéro sont rattachées au compte et apparaissent dans Mes tickets.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { C, TOUCH } from '../constants/theme';
import { BackButton, PrimaryButton } from '../components/ui/Buttons';
import { apiClient } from '../services/apiClient';
import { apiErrorMessage } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { useTicketBadge } from '../context/TicketBadgeContext';
import { showAlert } from '../utils/dialog';
import { toE164 } from '../utils/contacts';

const RESEND_AFTER = 60;

export default function VerifyPhoneScreen({ navigation, route }) {
  // required : compte sans numéro → étape obligatoire avant d'utiliser l'app
  const required = !!route?.params?.required;
  const { user, updateUser, logout } = useAuth();
  const { refresh: refreshBadges } = useTicketBadge();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [wait, setWait] = useState(0);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const startCountdown = () => {
    setWait(RESEND_AFTER);
    clearInterval(timer.current);
    timer.current = setInterval(() => setWait((w) => { if (w <= 1) { clearInterval(timer.current); return 0; } return w - 1; }), 1000);
  };

  const sendCode = async () => {
    const e164 = toE164(phone, '33');
    if (!e164) { setError('Numéro invalide : indiquez-le avec son indicatif (ex. +33 6 12 34 56 78).'); return; }
    setBusy(true); setError('');
    try {
      await apiClient.post('/api/auth/phone/send-code/', { phone_number: e164 });
      setStep('code');
      startCountdown();
    } catch (err) {
      if (err.response?.data?.code === 'sms_unavailable' && required) {
        // SMS pas encore activé : le numéro est enregistré, il sera vérifié plus tard
        try {
          const { data } = await apiClient.post('/api/auth/phone/', { phone_number: e164 });
          await updateUser(data.user);
          return;
        } catch (saveErr) {
          setError(apiErrorMessage(saveErr));
          return;
        }
      }
      setError(apiErrorMessage(err, "Le code n'a pas pu être envoyé."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true); setError('');
    try {
      const { data } = await apiClient.post('/api/auth/phone/verify/', { code });
      await updateUser(data.user);
      refreshBadges({ force: true });
      const n = data.invitations_found;
      if (required) return;   // la porte s'ouvre d'elle-même (user.phone renseigné)
      showAlert('Numéro vérifié',
        n ? `${n} invitation${n > 1 ? 's' : ''} reçue${n > 1 ? 's' : ''} par SMS ${n > 1 ? 'vous attendent' : 'vous attend'} dans Mes invitations.`
          : 'Les prochaines invitations envoyées à ce numéro arriveront directement dans votre application.',
        [{ text: n ? 'Voir mes invitations' : 'OK', onPress: () => (n ? navigation.navigate('TabTickets', { screen: 'Tickets', params: { tab: 'pending' } }) : navigation.goBack()) }]);
    } catch (err) {
      setError(apiErrorMessage(err, 'Code incorrect.'));
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('TabProfile', { screen: 'Profile' }));

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          {required && step === 'phone' ? <View style={{ width: 44 }} /> : (
            <BackButton variant="square" onPress={step === 'code' ? () => { setStep('phone'); setCode(''); setError(''); } : goBack} />
          )}
          <Text style={styles.headerTitle} accessibilityRole="header">Mon numéro de téléphone</Text>
          <View style={{ width: 44 }} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.icon}><Ionicons name={step === 'code' ? 'chatbubble-ellipses-outline' : 'call-outline'} size={30} color={C.green} /></View>
            {user?.phone_verified && step === 'phone' ? (
              <View style={styles.okBox}>
                <Ionicons name="checkmark-circle" size={18} color={C.green} />
                <Text style={styles.okTxt}>Numéro vérifié : {user.phone}. Vous pouvez le remplacer ci-dessous.</Text>
              </View>
            ) : null}
            {step === 'phone' ? (
              <>
                <Text style={styles.title}>{required ? 'Ajoutez votre numéro de téléphone' : 'Retrouvez vos invitations reçues par SMS'}</Text>
                <Text style={styles.text}>
                  {required ? 'Pour vous connecter à Easevent, votre numéro de téléphone est nécessaire. ' : ''}
                  Nous envoyons un code à ce numéro pour vérifier qu'il est bien à vous. Ensuite, toutes les invitations
                  envoyées à ce numéro apparaissent dans votre application.
                </Text>
                <Text style={styles.label} nativeID="phoneLabel">Numéro avec indicatif</Text>
                <TextInput style={styles.input} value={phone} onChangeText={(t) => { setPhone(t); setError(''); }}
                  placeholder="+33 6 12 34 56 78" placeholderTextColor={C.textFaint} keyboardType="phone-pad"
                  autoComplete="tel" accessibilityLabel="Numéro de téléphone avec indicatif" onSubmitEditing={sendCode} />
                {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
                <PrimaryButton label="Recevoir le code par SMS" icon="send-outline" onPress={sendCode} loading={busy} disabled={!phone.trim()} />
              </>
            ) : (
              <>
                <Text style={styles.title}>Entrez le code reçu</Text>
                <Text style={styles.text}>Code à 6 chiffres envoyé au {phone}. Il expire dans 10 minutes.</Text>
                <TextInput style={[styles.input, styles.code]} value={code}
                  onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                  placeholder="••••••" placeholderTextColor={C.textFaint} keyboardType="number-pad" maxLength={6}
                  autoComplete="sms-otp" textContentType="oneTimeCode" accessibilityLabel="Code de vérification à 6 chiffres"
                  onSubmitEditing={verify} />
                {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
                <PrimaryButton label="Vérifier" icon="checkmark-outline" onPress={verify} loading={busy} disabled={code.length !== 6} />
                <Pressable onPress={sendCode} disabled={wait > 0 || busy} style={styles.resend} accessibilityRole="button">
                  {busy ? <ActivityIndicator size="small" color={C.green} /> : (
                    <Text style={[styles.resendTxt, wait > 0 && { color: C.textMut }]}>
                      {wait > 0 ? `Renvoyer le code dans ${wait} s` : 'Renvoyer le code'}
                    </Text>
                  )}
                </Pressable>
              </>
            )}
            {required && (
              <Pressable onPress={() => logout({ revokeSession: true })} style={styles.resend} accessibilityRole="button"
                accessibilityHint="Vous restez visiteur : seuls les événements publics sont visibles">
                <Text style={[styles.resendTxt, { color: C.textSub }]}>Plus tard — continuer sans compte</Text>
              </Pressable>
            )}
            <View style={styles.privacy}>
              <Ionicons name="lock-closed-outline" size={14} color={C.green} />
              <Text style={styles.privacyTxt}>Votre numéro est chiffré et ne sert qu'à vous relier à vos invitations. Il n'est jamais montré aux autres membres.</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  scroll: { padding: 24, gap: 12, width: '100%', maxWidth: 480, alignSelf: 'center' },
  icon: { width: 64, height: 64, borderRadius: 20, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '900', color: C.text, textAlign: 'center' },
  text: { fontSize: 15, color: C.textSub, lineHeight: 22, textAlign: 'center', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: C.textSub, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.inputBg, paddingHorizontal: 16, fontSize: 17, color: C.text },
  code: { textAlign: 'center', fontSize: 26, letterSpacing: 10, fontWeight: '800' },
  error: { fontSize: 13, color: C.errorText },
  resend: { minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' },
  resendTxt: { fontSize: 14, fontWeight: '700', color: C.green },
  okBox: { flexDirection: 'row', gap: 8, backgroundColor: C.greenLight, borderRadius: 12, padding: 12 },
  okTxt: { flex: 1, fontSize: 13, color: C.greenDark, lineHeight: 18 },
  privacy: { flexDirection: 'row', gap: 8, marginTop: 12 },
  privacyTxt: { flex: 1, fontSize: 12, color: C.textSub, lineHeight: 17 },
});
