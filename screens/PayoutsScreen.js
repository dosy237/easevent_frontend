/**
 * PayoutsScreen.js — Easevent (organisateur : paiements & virements)
 * ════════════════════════════════════════════════════════════════
 * Stripe Connect (option A) : l'organisateur relie son compte bancaire
 * (IBAN) et vérifie son identité sur une page sécurisée Stripe. L'argent
 * de ses tickets lui est ensuite versé directement et viré
 * automatiquement sur son compte, commission Easevent déduite.
 * Accessible depuis le profil et depuis l'étape 5 de création
 * (événement payant).
 * ════════════════════════════════════════════════════════════════
 */
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';

import { C } from '../constants/theme';
import { BackButton, PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import ticketService from '../services/ticketService';
import { apiErrorMessage } from '../services/authService';

const STEPS = [
  ['person-circle-outline', 'Vos informations', 'Identité et adresse, demandées par la réglementation bancaire.'],
  ['business-outline', 'Votre IBAN', 'Le compte bancaire qui recevra l’argent de vos billets.'],
  ['swap-horizontal-outline', 'Virements automatiques', 'Stripe vire vos ventes sur votre compte, commission Easevent déduite.'],
];

export default function PayoutsScreen({ navigation }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await ticketService.connectStatus());
      setError('');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const open = async (fetchUrl) => {
    setBusy(true);
    setError('');
    try {
      const { url } = await fetchUrl();
      await WebBrowser.openAuthSessionAsync(url, 'easevent://profil/paiements');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Profile'));
  const active = status?.charges_enabled;
  const started = status?.connected && !active;

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <BackButton variant="square" onPress={goBack} />
          <Text style={styles.headerTitle} accessibilityRole="header">Paiements & virements</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {!status && !error ? (
            <ActivityIndicator color={C.green} size="large" style={{ marginTop: 40 }} accessibilityLabel="Chargement" />
          ) : (
            <>
              <View style={[styles.statusCard, active ? styles.statusOk : started ? styles.statusWait : null]}>
                <Ionicons
                  name={active ? 'checkmark-circle' : started ? 'time-outline' : 'card-outline'}
                  size={28}
                  color={active ? C.green : started ? C.orangeDark : C.text}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>
                    {active ? 'Paiements activés' : started ? 'Vérification en cours' : 'Recevez l’argent de vos billets'}
                  </Text>
                  <Text style={styles.statusText}>
                    {active
                      ? `Vos ventes sont versées sur votre compte Stripe puis virées automatiquement sur votre IBAN.${status.payouts_enabled ? '' : ' Les virements seront actifs dès la fin de la vérification.'}`
                      : started
                        ? 'Stripe vérifie vos informations. Complétez-les si une étape manque.'
                        : 'Pour vendre des billets, reliez votre compte bancaire. Cela prend environ 5 minutes.'}
                  </Text>
                </View>
              </View>

              {!active && STEPS.map(([icon, title, text]) => (
                <View key={title} style={styles.step}>
                  <View style={styles.stepIcon}><Ionicons name={icon} size={18} color={C.green} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{title}</Text>
                    <Text style={styles.stepText}>{text}</Text>
                  </View>
                </View>
              ))}

              <View style={styles.secure}>
                <Ionicons name="lock-closed-outline" size={14} color={C.green} />
                <Text style={styles.secureTxt}>
                  Vos coordonnées bancaires sont saisies et conservées par Stripe, notre prestataire de paiement agréé. Easevent n’y a jamais accès.
                </Text>
              </View>

              {status && !status.payments_available ? (
                <View style={styles.error}>
                  <Text style={styles.errorTxt}>Les paiements ne sont pas encore configurés sur le serveur.</Text>
                </View>
              ) : null}
              {error ? <View style={styles.error} accessibilityRole="alert"><Text style={styles.errorTxt}>{error}</Text></View> : null}
            </>
          )}
        </ScrollView>

        {status && (
          <View style={styles.footer}>
            {active ? (
              <SecondaryButton label="Gérer mes virements et mon IBAN" icon="open-outline" onPress={() => open(ticketService.connectDashboard)} disabled={busy} />
            ) : (
              <PrimaryButton
                label={started ? 'Compléter mes informations' : 'Activer les paiements'}
                icon="arrow-forward-outline"
                onPress={() => open(ticketService.connectOnboard)}
                loading={busy}
                disabled={!status.payments_available}
              />
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.white, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  scroll: { padding: 16, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center' },
  statusCard: { flexDirection: 'row', gap: 12, backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 16 },
  statusOk: { backgroundColor: C.greenLight, borderColor: C.greenSoft },
  statusWait: { backgroundColor: C.orangeL, borderColor: '#F6C9B9' },
  statusTitle: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 4 },
  statusText: { fontSize: 13, color: C.textSub, lineHeight: 19 },
  step: { flexDirection: 'row', gap: 12, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  stepIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  stepText: { fontSize: 13, color: C.textSub, lineHeight: 19 },
  secure: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  secureTxt: { flex: 1, fontSize: 12, color: C.textSub, lineHeight: 17 },
  error: { backgroundColor: C.errorBg, borderRadius: 12, padding: 12 },
  errorTxt: { fontSize: 13, color: C.errorText },
  footer: { backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, padding: 16, paddingBottom: 24 },
});
