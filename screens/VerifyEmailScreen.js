/**
 * VerifyEmailScreen.js — Easevent (M03)
 * ════════════════════════════════════════════════════════════════
 * Deux façons d'arriver ici :
 *
 * 1. Après l'inscription (ou une connexion refusée car l'email n'est
 *    pas vérifié) → params { email }.
 *    « Ouvrir ma messagerie », « Renvoyer l'email » (attente 60 s),
 *    « Modifier » (retour à l'inscription).
 *
 * 2. Depuis le lien reçu par email : easevent.app/verify/:token
 *    → POST /api/auth/verify-email/ puis connexion automatique.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../constants/theme';
import { BackButton, LinkButton, PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { EnvelopeIllustration } from '../components/illustrations';
import LoadingMessages from '../components/ui/LoadingMessages';
import { useAuth } from '../context/AuthContext';
import { authService, apiErrorMessage } from '../services/authService';

const RESEND_DELAY = 60;

// Webmails courants : on ouvre directement la bonne boîte
const WEBMAILS = [
  { match: /@(gmail|googlemail)\./i, url: 'https://mail.google.com/' },
  { match: /@(outlook|hotmail|live|msn)\./i, url: 'https://outlook.live.com/mail/' },
  { match: /@yahoo\./i, url: 'https://mail.yahoo.com/' },
  { match: /@(icloud|me|mac)\.com$/i, url: 'https://www.icloud.com/mail' },
  { match: /@orange\.fr$/i, url: 'https://messagerie.orange.fr/' },
  { match: /@(free)\.fr$/i, url: 'https://zimbra.free.fr/' },
  { match: /@(laposte)\.net$/i, url: 'https://www.laposte.net/accueil' },
];

const formatDelay = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function VerifyEmailScreen({ navigation, route }) {
  const { login } = useAuth();
  const token = route.params?.token;
  const [email, setEmail] = useState(route.params?.email || '');
  const [countdown, setCountdown] = useState(token || route.params?.canResendNow ? 0 : RESEND_DELAY);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [verifyState, setVerifyState] = useState(token ? 'verifying' : 'waiting'); // verifying | error | waiting
  const [error, setError] = useState('');
  const verifyStarted = useRef(false);

  // ── Compte à rebours avant de pouvoir renvoyer l'email ──────
  useEffect(() => {
    if (countdown <= 0) return undefined;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ── Ouverture depuis le lien de l'email ─────────────────────
  const verify = useCallback(async () => {
    try {
      const data = await authService.verifyEmail(token);
      // Connexion : RootNavigator bascule vers l'espace connecté
      await login({ userData: data.user, access: data.access, refresh: data.refresh });
    } catch (err) {
      const body = err.response?.data || {};
      if (body.email) setEmail(body.email);
      setError(apiErrorMessage(err, 'Ce lien est invalide ou a déjà été utilisé.'));
      setVerifyState('error');
    }
  }, [token, login]);

  useEffect(() => {
    if (token && !verifyStarted.current) {
      verifyStarted.current = true;
      verify();
    }
  }, [token, verify]);

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Login');
  };

  const openMailbox = () => {
    const webmail = WEBMAILS.find((w) => w.match.test(email));
    let url = webmail?.url || 'mailto:';
    if (!webmail && Platform.OS === 'ios') url = 'message://';
    Linking.openURL(url).catch(() => Linking.openURL('mailto:').catch(() => {}));
  };

  const resend = async () => {
    if (!email || countdown > 0) return;
    setSending(true);
    setNotice('');
    try {
      await authService.resendVerification(email);
      setNotice('Un nouveau lien vient de vous être envoyé.');
      setCountdown(RESEND_DELAY);
    } catch (err) {
      setNotice(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const editEmail = () => navigation.navigate('Login', { mode: 'register', prefillEmail: email });

  // ── Vérification en cours (lien email) ──────────────────────
  if (verifyState === 'verifying') {
    return (
      <View style={[styles.root, styles.center]}>
        <EnvelopeIllustration width={180} height={148} />
        <ActivityIndicator size="large" color={C.green} style={{ marginTop: 24 }} accessibilityLabel="Vérification en cours" />
        <LoadingMessages messages={[
          'Nous vérifions votre adresse…',
          'Nous préparons votre espace…',
          'Encore un instant…',
        ]} />
      </View>
    );
  }

  const hasError = verifyState === 'error';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <BackButton onPress={goBack} />
          </View>

          <View style={styles.body}>
            <EnvelopeIllustration />
            <View style={styles.texts}>
              <Text style={styles.title} accessibilityRole="header">
                {hasError ? 'Lien non valide' : 'Vérifiez votre boîte mail'}
              </Text>
              {hasError ? (
                <Text style={styles.subtitle}>{error}</Text>
              ) : (
                <Text style={styles.subtitle}>
                  Un lien de confirmation a été envoyé à{'\n'}
                  <Text style={styles.email}>{email || 'votre adresse email'}</Text>
                </Text>
              )}
            </View>
            {!hasError && (
              <View style={styles.pill}>
                <Ionicons name="time-outline" size={16} color={C.green} />
                <Text style={styles.pillTxt}>Le lien reste valable 24 heures</Text>
              </View>
            )}
          </View>

          <View style={styles.actions}>
            {notice ? (
              <View style={styles.notice} accessibilityLiveRegion="polite" aria-live="polite">
                <Ionicons name="checkmark-circle" size={16} color={C.green} />
                <Text style={styles.noticeTxt}>{notice}</Text>
              </View>
            ) : null}

            {hasError ? (
              <PrimaryButton
                label="Se connecter"
                icon="arrow-forward-outline"
                onPress={() => navigation.navigate('Login', { mode: 'login' })}
              />
            ) : (
              <PrimaryButton label="Ouvrir ma messagerie" icon="arrow-forward-outline" onPress={openMailbox} />
            )}

            {email ? (
              <SecondaryButton
                label={countdown > 0 ? `Renvoyer l'email dans ${formatDelay(countdown)}` : (sending ? 'Envoi…' : "Renvoyer l'email")}
                onPress={resend}
                disabled={countdown > 0 || sending}
              />
            ) : null}

            <View style={styles.editRow}>
              <Text style={styles.editTxt}>Mauvaise adresse ?</Text>
              <LinkButton label=" Modifier" onPress={editEmail} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { paddingTop: 12, flexDirection: 'row' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 24 },
  texts: { gap: 10, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '900', color: C.text, textAlign: 'center' },
  subtitle: { fontSize: 16, color: C.textSub, lineHeight: 24, textAlign: 'center' },
  email: { fontWeight: '700', color: C.text },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greenLight,
    borderWidth: 1, borderColor: C.greenSoft, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
  },
  pillTxt: { fontSize: 13, color: C.green, fontWeight: '600' },
  actions: { gap: 12 },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greenLight,
    borderRadius: 12, padding: 12,
  },
  noticeTxt: { flex: 1, fontSize: 13, color: C.greenDark, fontWeight: '600' },
  editRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  editTxt: { fontSize: 14, color: C.textMut },
});
