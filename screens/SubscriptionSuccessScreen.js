/**
 * SubscriptionSuccessScreen.js — Easevent (M22 · Paiement confirmé)
 * « Créer un événement » (E13) ou « Retour au profil » (E12).
 */
import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../constants/theme';
import { PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { useAuth } from '../context/AuthContext';
import subscriptionService from '../services/subscriptionService';

export default function SubscriptionSuccessScreen({ navigation, route }) {
  const plan = route?.params?.plan;
  const { updateUser } = useAuth();

  // Plan à jour dans l'application (le serveur fait foi)
  useEffect(() => {
    subscriptionService.overview().then((d) => updateUser({ subscription_plan: d.subscription.plan })).catch(() => {});
  }, [updateUser]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.badge}><Ionicons name="checkmark" size={46} color={C.white} /></View>
          <Text style={styles.title} accessibilityRole="header">
            {plan ? `Bienvenue dans le plan ${plan.name} !` : 'Abonnement activé !'}
          </Text>
          <Text style={styles.text}>Votre paiement est confirmé. Vos nouvelles fonctionnalités sont déjà disponibles.</Text>
          {plan?.features?.length ? (
            <View style={styles.card}>
              {plan.features.map((f) => (
                <View key={f} style={styles.feature}>
                  <Ionicons name="sparkles" size={16} color={C.orange} />
                  <Text style={styles.featureTxt}>{f}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={styles.small}>Le reçu vous est envoyé par email. Vous pouvez gérer votre abonnement dans Profil › Abonnement.</Text>
          <PrimaryButton label="Créer un événement" icon="add" onPress={() => navigation.navigate('TabCreate')} />
          <SecondaryButton label="Retour au profil" onPress={() => navigation.navigate('TabProfile', { screen: 'Profile' })} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.white },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14, width: '100%', maxWidth: 520, alignSelf: 'center' },
  badge: { width: 92, height: 92, borderRadius: 46, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '900', color: C.text, textAlign: 'center' },
  text: { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 22 },
  card: { backgroundColor: C.greenLight, borderRadius: 16, padding: 16, gap: 10 },
  feature: { flexDirection: 'row', gap: 8 },
  featureTxt: { flex: 1, fontSize: 14, color: C.greenDark, fontWeight: '600', lineHeight: 20 },
  small: { fontSize: 12, color: C.textMut, textAlign: 'center', lineHeight: 17 },
});
