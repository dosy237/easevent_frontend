/**
 * ResetPasswordScreen.js — Easevent (suite de M04)
 * ════════════════════════════════════════════════════════════════
 * Ouvert par le lien de l'email : easevent.app/reset-password/:uid/:token
 * Choix du nouveau mot de passe → POST /api/auth/password-reset/confirm/
 * Toutes les sessions ouvertes sont fermées côté serveur.
 * Même gabarit visuel que M04.
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

export default function ResetPasswordScreen({ navigation, route }) {
  const { uid, token } = route.params || {};
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const goToLogin = () => navigation.navigate('Login', { mode: 'login' });

  const submit = async () => {
    const next = {};
    if (password.length < 8) next.password = 'Minimum 8 caractères';
    if (confirm !== password) next.confirm = 'Les deux mots de passe ne correspondent pas';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    setError('');
    try {
      await authService.confirmPasswordReset({ uid, token, newPassword: password });
      setDone(true);
    } catch (err) {
      const body = err.response?.data || {};
      if (body.new_password) setErrors({ password: body.new_password });
      else setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const invalidLink = !uid || !token;

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <BackButton onPress={goToLogin} label="Retour à la connexion" />
              <Text style={styles.title} accessibilityRole="header">Nouveau mot de passe</Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.illu}><LockKeyIllustration /></View>

            {done ? (
              <>
                <View style={styles.success} accessibilityRole="alert" aria-live="polite">
                  <Ionicons name="checkmark-circle" size={18} color={C.green} />
                  <Text style={styles.successTxt}>
                    <Text style={{ fontWeight: '700' }}>Mot de passe modifié.</Text> Par sécurité, vos autres sessions ont été fermées.
                  </Text>
                </View>
                <PrimaryButton label="Se connecter" icon="arrow-forward-outline" onPress={goToLogin} style={{ marginTop: 24 }} />
              </>
            ) : invalidLink ? (
              <>
                <Text style={styles.intro}>Ce lien est incomplet. Demandez un nouveau lien de réinitialisation.</Text>
                <PrimaryButton label="Demander un nouveau lien" onPress={() => navigation.navigate('ForgotPassword')} />
              </>
            ) : (
              <>
                <Text style={styles.intro}>Choisissez un mot de passe d'au moins 8 caractères, difficile à deviner.</Text>

                {error ? (
                  <View style={styles.errorBanner} accessibilityLiveRegion="polite" aria-live="polite">
                    <Ionicons name="alert-circle-outline" size={16} color={C.errorText} />
                    <Text style={styles.errorTxt}>{error}</Text>
                  </View>
                ) : null}

                <AuthInput
                  icon="lock-closed-outline"
                  label="Nouveau mot de passe"
                  value={password}
                  onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: '' })); }}
                  secureEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  error={errors.password}
                />
                <AuthInput
                  icon="lock-closed-outline"
                  label="Confirmer le mot de passe"
                  value={confirm}
                  onChangeText={(t) => { setConfirm(t); setErrors((e) => ({ ...e, confirm: '' })); }}
                  secureEntry
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={submit}
                  error={errors.confirm}
                />
                <PrimaryButton label="Enregistrer" icon="checkmark-outline" onPress={submit} loading={loading} />
                {error ? (
                  <LinkButton label="Demander un nouveau lien" onPress={() => navigation.navigate('ForgotPassword')} style={{ alignSelf: 'center', marginTop: 8 }} />
                ) : null}
              </>
            )}
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
  title: { fontSize: 22, fontWeight: '900', color: C.text },
  illu: { alignItems: 'center', marginBottom: 20 },
  intro: { fontSize: 16, color: C.textSub, lineHeight: 24, marginBottom: 24, textAlign: 'center' },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.errorBg,
    padding: 12, borderRadius: 12, marginBottom: 16,
  },
  errorTxt: { flex: 1, color: C.errorText, fontSize: 13, fontWeight: '500' },
  success: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: C.greenLight,
    borderWidth: 1, borderColor: C.greenSoft, borderRadius: 14, padding: 14,
  },
  successTxt: { flex: 1, fontSize: 13, color: C.greenDark, lineHeight: 19 },
});
