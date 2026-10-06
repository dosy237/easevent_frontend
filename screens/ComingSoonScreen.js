/**
 * ComingSoonScreen.js — Easevent
 * ════════════════════════════════════════════════════════════════
 * Écran d'attente pour les routes du MVP pas encore développées
 * (MD §7, étape 1 : « toute la navigation fonctionne »).
 * Chaque route passe son identifiant de maquette et son titre :
 *   <Stack.Screen name="Notifications" component={ComingSoonScreen}
 *     initialParams={{ screenId: 'M17', title: 'Notifications' }} />
 * Il sera remplacé par le vrai écran au lot correspondant.
 * ════════════════════════════════════════════════════════════════
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { C } from '../constants/theme';
import { BackButton, PrimaryButton } from '../components/ui/Buttons';
import { WorkInProgressIllustration } from '../components/illustrations';

export default function ComingSoonScreen({ navigation, route }) {
  const { title = 'Bientôt disponible', screenId, description } = route.params || {};
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'));

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton variant="square" onPress={goBack} />
          <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">{title}</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.body}>
          <WorkInProgressIllustration />
          <Text style={styles.title}>Cet écran arrive bientôt</Text>
          <Text style={styles.text}>
            {description || 'Nous finalisons cette fonctionnalité. Elle sera disponible dans une prochaine mise à jour.'}
          </Text>
          {screenId ? <Text style={styles.ref}>Réf. maquette {screenId}</Text> : null}
          <PrimaryButton label="Retour" icon="arrow-back-outline" onPress={goBack} style={styles.btn} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  safe: { flex: 1 },
  header: {
    backgroundColor: C.white, paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: C.text },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { fontSize: 20, fontWeight: '900', color: C.text, textAlign: 'center' },
  text: { fontSize: 15, color: C.textSub, textAlign: 'center', lineHeight: 22, maxWidth: 340 },
  ref: { fontSize: 12, color: C.textMut, fontWeight: '600' },
  btn: { alignSelf: 'stretch', marginTop: 12, maxWidth: 360, width: '100%' },
});
