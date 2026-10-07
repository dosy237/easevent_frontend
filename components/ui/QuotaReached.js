/**
 * components/ui/QuotaReached.js — l'événement du mois est déjà créé (plan Gratuit)
 * Affiché à la place du formulaire de création : on explique la règle,
 * la date à laquelle une nouvelle place se libère, et on propose les plans.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { C } from '../../constants/theme';
import { PrimaryButton, SecondaryButton } from './Buttons';
import { frenchDay } from '../../utils/plans';

export default function QuotaReached({ quota, onPlans, onMyEvents, onDiscover }) {
  const n = quota?.limit ?? 1;
  return (
    <View style={styles.wrap}>
      <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="calendar-outline" size={34} color={C.green} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {n > 1 ? `Vos ${n} événements du mois sont créés` : 'Votre événement du mois est créé'}
      </Text>
      <Text style={styles.body}>
        Le plan Gratuit permet {n} événement{n > 1 ? 's' : ''} par mois. Avec les plans Standard et Pro, créez
        autant d'événements que vous voulez, avec plus d'invités. En attendant, vous pouvez participer
        librement à tous les événements publics.
      </Text>
      {quota?.resets_on ? (
        <Text style={styles.reset}>Une nouvelle place se libère le {frenchDay(quota.resets_on)}.</Text>
      ) : null}
      <PrimaryButton label="Passer au plan Standard" icon="sparkles-outline" onPress={onPlans} style={styles.btn} />
      <SecondaryButton label="Découvrir les événements publics" onPress={onDiscover} style={styles.btn} />
      <SecondaryButton label="Voir mes événements" onPress={onMyEvents} style={styles.btn} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontSize: 21, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 10 },
  body: { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 22, marginBottom: 10, maxWidth: 420 },
  reset: { fontSize: 14, color: C.green, fontWeight: '700', textAlign: 'center', marginBottom: 22 },
  btn: { alignSelf: 'stretch', marginTop: 10, maxWidth: 420, width: '100%' },
});
