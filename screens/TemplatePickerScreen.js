/**
 * screens/TemplatePickerScreen.js — M07 · Choisir son mini-site parmi 6 propositions
 * ════════════════════════════════════════════════════════════════
 * Aperçus réels (le vrai rendu, réduit), une direction artistique par proposition.
 * « Voir en entier » ouvre l'aperçu plein écran ; « Choisir ce modèle » le publie
 * pour les invités ; « Régénérer » relance (selon le quota du plan).
 * params : { event, generationId }
 * ════════════════════════════════════════════════════════════════
 */
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import MiniSite from '../components/minisite/MiniSite';
import { useMiniSiteFonts } from '../components/minisite/fonts';
import { BackButton, PrimaryButton, SecondaryButton } from '../components/ui/Buttons';
import { C } from '../constants/theme';
import eventService from '../services/eventService';
import minisiteService from '../services/minisiteService';
import { showAlert } from '../utils/dialog';

const BASE_W = 390;

// Aperçu réduit et défilable : on parcourt toute la proposition avant de choisir
function Preview({ spec, event, width, height }) {
  const scale = width / BASE_W;
  const [inner, setInner] = useState(0);
  return (
    <View style={{ width, height, overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: spec.theme?.colors?.bg }}>
      <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} contentContainerStyle={{ height: inner * scale || undefined }}>
        <View style={{ width: BASE_W, transform: [{ scale }], transformOrigin: 'top left' }} pointerEvents="none"
          onLayout={(e) => setInner(e.nativeEvent.layout.height)}
          accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <MiniSite spec={spec} event={event} width={BASE_W} preview />
        </View>
      </ScrollView>
    </View>
  );
}

export default function TemplatePickerScreen({ route, navigation }) {
  const { event: initialEvent } = route?.params || {};
  const { width, height } = useWindowDimensions();
  const [gen, setGen] = useState(null);
  const [event, setEvent] = useState(initialEvent);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const list = useRef(null);
  const fontsReady = useMiniSiteFonts((gen?.proposals || []).map((p) => p.spec?.theme?.fonts));

  useEffect(() => {
    if (!initialEvent?.id) return;
    Promise.all([minisiteService.generation(initialEvent.id), eventService.fetchEventDetail(initialEvent.id).catch(() => null)])
      .then(([g, d]) => { setGen(g); if (d?.event) setEvent({ ...initialEvent, ...d.event }); })
      .catch(() => setError(true));
  }, [initialEvent?.id]);

  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Dashboard'));
  const proposals = gen?.proposals || [];
  const current = proposals[index];
  const pageW = Math.min(width, 520);
  const previewW = pageW - 64;
  const previewH = Math.max(320, Math.min(height * 0.56, 640));

  const go = (i) => {
    const next = Math.min(proposals.length - 1, Math.max(0, i));
    setIndex(next);
    list.current?.scrollToOffset({ offset: next * pageW, animated: true });
  };

  const choose = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await minisiteService.choose(event.id, current.id);
      showAlert('Mini-site choisi', `Le modèle « ${current.label} » est en ligne dans l'application : vos invités le voient depuis la page de l'événement.`, [
        { text: 'Retoucher', onPress: () => navigation.replace('MiniSiteEditor', { eventId: event.id }) },
        { text: 'Voir mon mini-site', onPress: () => navigation.replace('MiniSiteView', { eventId: event.id }) },
      ]);
    } catch (err) {
      showAlert('Choix impossible', err.response?.data?.detail || 'Vérifiez votre connexion puis réessayez.');
    } finally {
      setBusy(false);
    }
  };

  const regenerate = () => {
    const q = gen?.quota;
    const left = q?.remaining == null ? '' : ` Il vous reste ${q.remaining} génération${q.remaining > 1 ? 's' : ''} pour cet événement.`;
    showAlert('Nouvelles propositions ?', `Nous composons 6 nouveaux mini-sites, tous différents de ceux-ci.${left}`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Régénérer', onPress: () => navigation.replace('MiniSiteGenerating', { event, regenerate: true }) },
    ]);
  };

  if (error || !gen || !fontsReady) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        {error ? (
          <>
            <Text style={styles.title}>Propositions indisponibles</Text>
            <SecondaryButton label="Retour" onPress={goBack} />
          </>
        ) : <ActivityIndicator color={C.green} />}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <BackButton variant="square" onPress={goBack} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.title} accessibilityRole="header">Choisissez votre mini-site</Text>
          <Text style={styles.sub}>{`${index + 1} sur ${proposals.length} · glissez pour comparer`}</Text>
        </View>
        <Pressable onPress={regenerate} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Régénérer des propositions">
          <Ionicons name="refresh" size={20} color={C.green} />
        </Pressable>
      </View>

      <FlatList
        ref={list}
        data={proposals}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        snapToInterval={pageW}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, alignSelf: 'center', width: pageW }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / pageW))}
        onScroll={(e) => setIndex(Math.min(proposals.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / pageW))))}
        scrollEventThrottle={64}
        getItemLayout={(_, i) => ({ length: pageW, offset: pageW * i, index: i })}
        initialNumToRender={2}
        windowSize={3}
        renderItem={({ item }) => (
          <View style={{ width: pageW, alignItems: 'center', paddingTop: 8 }}>
            <Preview spec={item.spec} event={event} width={previewW} height={previewH} />
          </View>
        )}
      />

      <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {proposals.map((p, i) => <View key={p.id} style={[styles.dot, i === index && styles.dotOn]} />)}
      </View>

      {current ? (
        <View style={styles.info}>
          <Text style={styles.label}>{current.label}</Text>
          {current.mood ? <Text style={styles.mood}>{current.mood}</Text> : null}
          <View style={styles.nav}>
            <Pressable onPress={() => go(index - 1)}
              disabled={index === 0} style={[styles.navBtn, index === 0 && { opacity: 0.35 }]} accessibilityRole="button" accessibilityLabel="Proposition précédente">
              <Ionicons name="chevron-back" size={22} color={C.text} />
            </Pressable>
            <PrimaryButton label="Choisir ce modèle" loading={busy} onPress={choose} style={{ flex: 1 }} />
            <Pressable onPress={() => go(index + 1)}
              disabled={index === proposals.length - 1} style={[styles.navBtn, index === proposals.length - 1 && { opacity: 0.35 }]}
              accessibilityRole="button" accessibilityLabel="Proposition suivante">
              <Ionicons name="chevron-forward" size={22} color={C.text} />
            </Pressable>
          </View>
          <Pressable onPress={() => navigation.navigate('MiniSiteView', { eventId: event.id, spec: current.spec, event })} accessibilityRole="button">
            <Text style={styles.link}>Voir en entier</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  title: { fontSize: 18, fontWeight: '800', color: C.text },
  sub: { fontSize: 13, color: C.textSub, marginTop: 2 },
  iconBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.border },
  dotOn: { width: 22, backgroundColor: C.green },
  info: { paddingHorizontal: 20, paddingTop: 12, alignItems: 'center', alignSelf: 'center', width: '100%', maxWidth: 520 },
  label: { fontSize: 20, fontWeight: '800', color: C.text },
  mood: { fontSize: 14, color: C.textSub, marginTop: 2, fontStyle: 'italic' },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, alignSelf: 'stretch' },
  navBtn: { width: 48, height: 52, borderRadius: 14, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  link: { color: C.green, fontWeight: '700', fontSize: 15, paddingVertical: 12 },
});
