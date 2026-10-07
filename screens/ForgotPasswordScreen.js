/**
 * ForgotPasswordScreen.js — Easevent (M04)
 * ════════════════════════════════════════════════════════════════
 * Saisie de l'email → POST /api/auth/password-reset/
 * → message « Lien envoyé » (lien valable 1 heure).
 * La réponse est la même que le compte existe ou non (sécurité).
 * ════════════════════════════════════════════════════════════════
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../constants/theme';
import { BackButton, LinkButton, PrimaryButton } from '../components/ui/Buttons';
import AuthInput from '../components/ui/AuthInput';
import { LockKeyIllustration } from '../components/illustrations';
import { authService, apiErrorMessage } from '../services/authService';

const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function ForgotPasswordScreen({ navigation, route }) {
  const [email, setEmail] = useState(route.params?.email || '');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const goToLogin = () => navigation.navigate('Login', { mode: 'login', prefillEmail: email });
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : goToLogin());

  const submit = async () => {
    const value = email.trim();
    if (!value) return setFieldError("L'email est requis");
    if (!isEmail(value)) return setFieldError("Format d'email invalide");
    setLoading(true);
    setError('');
    try {
      await authService.requestPasswordReset(value);
      setSent(true);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <BackButton onPress={goBack} />
              <Text style={styles.title} accessibilityRole="header">Mot de passe</Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.illu}><LockKeyIllustration /></View>

            <Text style={styles.intro}>
              Saisissez l'email de votre compte. Nous vous envoyons un lien pour choisir un nouveau mot de passe.
            </Text>

            {error ? (
              <View style={styles.errorBanner} accessibilityLiveRegion="polite" aria-live="polite">
                <Ionicons name="alert-circle-outline" size={16} color={C.errorText} />
                <Text style={styles.errorTxt}>{error}</Text>
              </View>
            ) : null}

            <AuthInput
              icon="mail-outline"
              label="Adresse email"
              value={email}
              onChangeText={(t) => { setEmail(t); setFieldError(''); setSent(false); }}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={submit}
              error={fieldError}
            />

            <PrimaryButton
              label={sent ? 'Renvoyer le lien' : 'Envoyer le lien'}
              icon="send-outline"
              onPress={submit}
              loading={loading}
            />

            {sent ? (
              <View style={styles.success} accessibilityRole="alert" aria-live="polite">
                <Ionicons name="checkmark-circle" size={18} color={C.green} />
                <Text style={styles.successTxt}>
                  <Text style={{ fontWeight: '700' }}>Lien envoyé.</Text> Pensez à vérifier vos spams — le lien expire dans 1 heure.
                </Text>
              </View>
            ) : null}

            <View style={{ flex: 1, minHeight: 24 }} />
            <View style={styles.footer}>
              <Text style={styles.footerTxt}>Vous vous en souvenez ?</Text>
              <LinkButton label=" Se connecter" onPress={goToLogin} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 24, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '900', color: C.text },
  illu: { alignItems: 'center', marginBottom: 20 },
  intro: { fontSize: 16, color: C.textSub, lineHeight: 24, marginBottom: 28, textAlign: 'center' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.errorBg,
    padding: 12, borderRadius: 12, marginBottom: 16,
  },
  errorTxt: { flex: 1, color: C.errorText, fontSize: 13, fontWeight: '500' },
  success: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.greenLight,
    borderWidth: 1, borderColor: C.greenSoft, borderRadius: 14, padding: 14, marginTop: 20,
  },
  successTxt: { flex: 1, fontSize: 13, color: C.greenDark, lineHeight: 19 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerTxt: { fontSize: 14, color: C.textMut },
});
