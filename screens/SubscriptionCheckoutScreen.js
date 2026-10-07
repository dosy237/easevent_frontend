/**
 * SubscriptionCheckoutScreen.js — Easevent (M21 · Paiement de l'abonnement)
 * ════════════════════════════════════════════════════════════════
 * Récapitulatif du plan choisi, puis paiement sur la page sécurisée
 * Stripe (carte, Apple Pay, Google Pay). Au retour, l'écran attend la
 * confirmation de Stripe au serveur avant d'afficher M22.
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { C } from '../constants/theme';
import { BackButton, PrimaryButton } from '../components/ui/Buttons';
import subscriptionService from '../services/subscriptionService';
import { apiErrorMessage } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { euros } from './PlansScreen';

const POLL_EVERY = 2500;
const POLL_FOR = 40000;

export default function SubscriptionCheckoutScreen({ navigation, route }) {
  const { plan, interval = 'monthly' } = route.params || {};
  const { updateUser } = useAuth();
  const [phase, setPhase] = useState('idle');      // idle | opening | waiting
  const [error, setError] = useState('');
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  if (!plan) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
        <Text style={styles.text}>Choisissez d'abord un plan.</Text>
        <PrimaryButton label="Voir les plans" onPress={() => navigation.navigate('Plans')} />
      </View>
    );
  }

  const price = plan[interval];
  const waitForActivation = async () => {
    setPhase('waiting');
    const until = Date.now() + POLL_FOR;
    while (alive.current && Date.now() < until) {
      try {
        const { subscription } = await subscriptionService.overview();
        if (subscription.plan === plan.id) {
          updateUser({ subscription_plan: plan.id });
          navigation.replace('SubscriptionSuccess', { plan });
          return;
        }
      } catch { /* réseau instable : on réessaie */ }
      await new Promise((r) => setTimeout(r, POLL_EVERY));
    }
    if (alive.current) {
      setPhase('idle');
      setError("Nous n'avons pas encore reçu la confirmation de Stripe. Si vous avez payé, votre plan s'activera dans quelques instants (vous recevrez une notification).");
    }
  };

  const pay = async () => {
    setError('');
    setPhase('opening');
    try {
      const res = await subscriptionService.checkout(plan.id, interval);
      if (res.changed) {
        updateUser({ subscription_plan: res.state?.plan || plan.id });
        navigation.replace('SubscriptionSuccess', { plan });
        return;
      }
      const result = await WebBrowser.openAuthSessionAsync(res.checkout_url, 'easevent://profil/abonnement/succes');
      if (result?.type === 'cancel' || result?.type === 'dismiss') {
        // Fermé sans payer… ou paiement fini sans redirection : on vérifie quand même
        await waitForActivation();
        return;
      }
      await waitForActivation();
    } catch (err) {
      setError(apiErrorMessage(err, 'Le paiement est momentanément indisponible.'));
      setPhase('idle');
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <BackButton variant="square" onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle} accessibilityRole="header">Paiement</Text>
          <View style={styles.secure}>
            <Ionicons name="lock-closed-outline" size={14} color={C.green} />
            <Text style={styles.secureTxt}>Sécurisé</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.card}>
            <Text style={styles.kicker}>Plan {plan.name}</Text>
            <Text style={styles.price}>{euros(price)}<Text style={styles.per}> / {interval === 'annual' ? 'an' : 'mois'}</Text></Text>
            {interval === 'annual' ? <Text style={styles.text}>soit {euros(Math.round(price / 12))} par mois — 2 mois offerts</Text> : null}
            <View style={styles.sep} />
            {plan.features.map((f) => (
              <View key={f} style={styles.feature}>
                <Ionicons name="checkmark-circle" size={18} color={C.green} />
                <Text style={styles.featureTxt}>{f}</Text>
              </View>
            ))}
          </View>

          <View style={styles.summary}>
            <Row label="Aujourd'hui" value={euros(price)} strong />
            <Row label="Renouvellement" value={interval === 'annual' ? 'Chaque année' : 'Chaque mois'} />
            <Row label="Engagement" value="Aucun, résiliable à tout moment" />
          </View>

          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}

          <PrimaryButton label={phase === 'waiting' ? 'Confirmation en cours…' : `Payer ${euros(price)}`} icon="card-outline"
            onPress={pay} loading={phase !== 'idle'} />
          <Text style={styles.note}>
            Vous allez être redirigé vers la page de paiement sécurisée de Stripe (carte bancaire, Apple Pay ou
            Google Pay). Easevent ne voit ni ne stocke vos données bancaires.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Row({ label, value, strong }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && { fontWeight: '900', fontSize: 16 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.greenLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  secureTxt: { fontSize: 12, fontWeight: '800', color: C.green },
  scroll: { padding: 16, gap: 14, paddingBottom: 40, width: '100%', maxWidth: 560, alignSelf: 'center' },
  card: { backgroundColor: C.white, borderRadius: 20, padding: 18, borderWidth: 1.5, borderColor: C.green },
  kicker: { fontSize: 13, fontWeight: '800', color: C.green, textTransform: 'uppercase', letterSpacing: 0.5 },
  price: { fontSize: 30, fontWeight: '900', color: C.text, marginTop: 4 },
  per: { fontSize: 15, fontWeight: '600', color: C.textSub },
  text: { fontSize: 14, color: C.textSub, lineHeight: 20 },
  sep: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  feature: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  featureTxt: { flex: 1, fontSize: 14, color: C.text, lineHeight: 20 },
  summary: { backgroundColor: C.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.border, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { fontSize: 14, color: C.textSub },
  rowValue: { flexShrink: 1, textAlign: 'right', fontSize: 14, fontWeight: '700', color: C.text },
  error: { fontSize: 14, color: C.errorText, lineHeight: 20 },
  note: { fontSize: 12, color: C.textMut, lineHeight: 17, textAlign: 'center' },
});
